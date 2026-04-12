"""ECI Pipeline Orchestrator — run the full pipeline or individual stages."""
import sys
import argparse
from datetime import datetime

from utils.db import init_db, get_session, Change, AgentEvent, Recommendation, Source
from scripts.seed_sources import seed_sources
from scripts.scraper import scrape_all
from scripts.diff_detector import detect_changes
from rag.chunker import chunk_change
from rag.embedder import add_chunks, get_collection_stats


def stage_seed():
    """Stage 1: Seed source registry."""
    print("\n=== STAGE 1: SEED SOURCES ===")
    init_db()
    seed_sources()


def stage_scrape():
    """Stage 2: Fetch snapshots from all sources."""
    print("\n=== STAGE 2: SCRAPE SOURCES ===")
    scrape_all()


def stage_diff():
    """Stage 3: Detect changes between snapshots."""
    print("\n=== STAGE 3: DETECT CHANGES ===")
    detect_changes()


def stage_embed():
    """Stage 4: Chunk and embed changes into ChromaDB."""
    print("\n=== STAGE 4: CHUNK + EMBED ===")
    session = get_session()

    # Get changes that haven't been embedded yet
    # We track this by checking if chunks exist for each change
    changes = session.query(Change).all()
    total_chunks = 0

    for change in changes:
        # Look up source for category/name context
        source = session.query(Source).filter_by(id=change.source_id).first()
        source_category = source.category if source else ""
        source_name = source.name if source else ""

        chunks = chunk_change(
            change, change.source_id,
            source_category=source_category,
            source_name=source_name,
        )
        if chunks:
            added = add_chunks(chunks)
            total_chunks += added
            print(f"  Change #{change.id}: {added} chunks embedded")

    session.close()
    stats = get_collection_stats()
    print(f"[EMBED] {total_chunks} chunks processed. Total in store: {stats['total_chunks']}")


def stage_graph():
    """Stage 4b: Build knowledge graph from change entities."""
    print("\n=== STAGE 4b: KNOWLEDGE GRAPH ===")
    from rag.entity_extractor import extract_from_change
    from rag.knowledge_graph import KnowledgeGraph

    session = get_session()
    changes = session.query(Change).all()
    kg = KnowledgeGraph.load_or_create()

    for change in changes:
        source = session.query(Source).filter_by(id=change.source_id).first()
        entities = extract_from_change(change)
        if entities.entity_count > 0:
            kg.add_change_entities(
                change_id=change.id,
                source_id=change.source_id,
                entity_set=entities,
                source_category=source.category if source else "",
            )
            print(f"  Change #{change.id}: {entities.entity_count} entities, "
                  f"{len(entities.relationships)} relationships")

    graph_path = kg.save()
    stats = kg.stats()
    session.close()
    print(f"[GRAPH] {stats['total_nodes']} nodes, {stats['total_edges']} edges")
    print(f"  Node types: {stats['node_types']}")
    print(f"  Edge types: {stats['edge_types']}")
    print(f"  Saved to: {graph_path}")


def stage_triage():
    """Stage 5: Run Sentinel Agent on pending changes."""
    print("\n=== STAGE 5: SENTINEL TRIAGE ===")
    from agents.sentinel import run_sentinel
    run_sentinel()


def stage_coordinate():
    """Stage 6: Run Coordinator Agent on escalated changes."""
    print("\n=== STAGE 6: COORDINATOR ===")
    from agents.coordinator import run_coordinator
    run_coordinator()


def stage_report():
    """Stage 7: Generate a summary report of all findings."""
    print("\n=== STAGE 7: REPORT ===")
    session = get_session()

    # Count stats
    total_changes = session.query(Change).count()
    pending = session.query(Change).filter_by(status="pending").count()
    triaged = session.query(Change).filter_by(status="triaged").count()
    escalated = session.query(Change).filter_by(status="escalated").count()
    closed = session.query(Change).filter_by(status="closed").count()

    sentinel_events = session.query(AgentEvent).filter_by(agent_name="sentinel").count()
    coord_events = session.query(AgentEvent).filter_by(agent_name="coordinator").count()
    recs = session.query(Recommendation).count()

    vec_stats = get_collection_stats()

    print(f"""
╔══════════════════════════════════════════════════╗
║           ECI Pipeline Report                     ║
║           {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}                  ║
╠══════════════════════════════════════════════════╣
║  Changes:     {total_changes:>4} total                         ║
║    Pending:   {pending:>4}                                ║
║    Triaged:   {triaged:>4} (not relevant)                 ║
║    Escalated: {escalated:>4} (awaiting coordinator)        ║
║    Closed:    {closed:>4} (fully processed)              ║
╠══════════════════════════════════════════════════╣
║  Agent Events:                                    ║
║    Sentinel:    {sentinel_events:>4} triage events               ║
║    Coordinator: {coord_events:>4} recommendations              ║
╠══════════════════════════════════════════════════╣
║  Action Tickets: {recs:>4}                               ║
║  Vector Chunks:  {vec_stats['total_chunks']:>4}                               ║
╚══════════════════════════════════════════════════╝
""")

    # Print Action Tickets if any
    recommendations = session.query(Recommendation).order_by(
        Recommendation.risk_score.desc()
    ).all()

    if recommendations:
        print("=== ACTION TICKETS ===\n")
        for rec in recommendations:
            print(f"  [{rec.priority.upper()}] {rec.title}")
            print(f"    Risk Score: {rec.risk_score}")
            print(f"    Owner: {rec.owner_suggestion}")
            print(f"    Summary: {rec.summary[:200]}")
            if rec.recommended_actions:
                print(f"    Actions: {len(rec.recommended_actions)} recommended")
            print()

    session.close()


def run_full_pipeline():
    """Run all stages in sequence."""
    print(f"\n{'='*60}")
    print(f"  ECI PIPELINE — Full Run")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    stage_seed()
    stage_scrape()
    stage_diff()
    stage_embed()
    stage_graph()
    stage_triage()
    stage_coordinate()
    stage_report()


def main():
    parser = argparse.ArgumentParser(description="ECI Pipeline Orchestrator")
    parser.add_argument(
        "--stage",
        choices=["seed", "scrape", "diff", "embed", "graph", "triage", "coordinate", "report", "all"],
        default="all",
        help="Pipeline stage to run (default: all)",
    )
    args = parser.parse_args()

    # Always ensure DB exists
    init_db()

    stage_map = {
        "seed": stage_seed,
        "scrape": stage_scrape,
        "diff": stage_diff,
        "embed": stage_embed,
        "graph": stage_graph,
        "triage": stage_triage,
        "coordinate": stage_coordinate,
        "report": stage_report,
        "all": run_full_pipeline,
    }

    stage_map[args.stage]()


if __name__ == "__main__":
    main()
