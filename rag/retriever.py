"""DeltaRAG + Graph-RAG Retriever — retrieve change-grounded context for agents."""
from rag.embedder import query_similar
from rag.entity_extractor import extract_entities
from rag.knowledge_graph import KnowledgeGraph
from utils.db import get_session, Change, Source, Recommendation


def retrieve_context(query: str, top_k: int = 5, source_filter: int = None,
                     category_filter: str = None) -> dict:
    """Retrieve relevant context chunks and format for agent consumption.

    Args:
        query: Natural language query or change description
        top_k: Number of chunks to retrieve
        source_filter: Optional source_id to restrict retrieval
        category_filter: Optional source_category to restrict retrieval

    Returns:
        {
            "chunks": [list of retrieved chunks],
            "formatted_context": "numbered evidence string for LLM",
            "chunk_ids": [list of chunk IDs for citation]
        }
    """
    filters = None
    if source_filter and category_filter:
        filters = {"$and": [
            {"source_id": source_filter},
            {"source_category": category_filter},
        ]}
    elif source_filter:
        filters = {"source_id": source_filter}
    elif category_filter:
        filters = {"source_category": category_filter}

    chunks = query_similar(query, top_k=top_k, filters=filters)

    # Format as numbered evidence blocks for the agent
    evidence_blocks = []
    chunk_ids = []
    for idx, chunk in enumerate(chunks, 1):
        evidence_blocks.append(
            f"[Evidence {idx}] (source_id={chunk['metadata'].get('source_id', '?')}, "
            f"category={chunk['metadata'].get('source_category', '?')}, "
            f"change_id={chunk['metadata'].get('change_id', '?')}, "
            f"kind={chunk['metadata'].get('kind', '?')}, "
            f"distance={chunk['distance']:.4f})\n"
            f"{chunk['text'][:800]}"
        )
        chunk_ids.append(chunk["id"])

    formatted = "\n\n".join(evidence_blocks) if evidence_blocks else "No relevant evidence found."

    return {
        "chunks": chunks,
        "formatted_context": formatted,
        "chunk_ids": chunk_ids,
    }


def retrieve_graph_rag(change_text: str, source_id: int, top_k: int = 5) -> dict:
    """Graph-RAG retrieval: combine vector similarity with knowledge graph traversal.

    This replaces the old retrieve_cross_source() with true Graph-RAG:
    1. Standard DeltaRAG vector search for semantically similar chunks
    2. Extract entities from the change text
    3. Traverse knowledge graph 2 hops from extracted entities
    4. Retrieve chunks associated with connected change events
    5. Merge and deduplicate results

    Args:
        change_text: The change content to find cross-source connections for
        source_id: Source ID of the current change (to identify cross-source)
        top_k: Number of results to return

    Returns:
        Same format as retrieve_context() plus graph metadata.
    """
    # Step 1: Vector similarity search (exclude same-source)
    all_chunks = query_similar(change_text, top_k=top_k * 2)
    vector_chunks = [c for c in all_chunks if c["metadata"].get("source_id") != source_id]

    # Step 2: Extract entities from change text
    entities = extract_entities(change_text)
    entity_ids = [e.value for e in entities.entities]

    # Step 3: Knowledge graph traversal
    graph_chunk_ids = set()
    graph_change_ids = []
    if entity_ids:
        kg = KnowledgeGraph.load_or_create()
        graph_change_ids = kg.get_related_change_ids(entity_ids, max_hops=2)

        # Step 4: Get chunks for graph-discovered change events
        for cid in graph_change_ids:
            # Find chunks belonging to this change from vector store
            try:
                change_chunks = query_similar(
                    change_text, top_k=3,
                    filters={"change_id": cid}
                )
                for c in change_chunks:
                    if c["metadata"].get("source_id") != source_id:
                        graph_chunk_ids.add(c["id"])
                        # Add to results if not already present
                        if not any(vc["id"] == c["id"] for vc in vector_chunks):
                            vector_chunks.append(c)
            except Exception:
                pass

    # Step 5: Deduplicate and limit
    seen_ids = set()
    merged = []
    for chunk in vector_chunks:
        if chunk["id"] not in seen_ids:
            seen_ids.add(chunk["id"])
            merged.append(chunk)
    merged = merged[:top_k]

    # Format evidence blocks
    evidence_blocks = []
    chunk_ids = []
    for idx, chunk in enumerate(merged, 1):
        # Look up source name
        session = get_session()
        src = session.query(Source).filter_by(id=chunk["metadata"].get("source_id")).first()
        source_name = src.name if src else "Unknown"
        session.close()

        # Mark graph-discovered evidence
        discovery = "graph" if chunk["id"] in graph_chunk_ids else "vector"

        evidence_blocks.append(
            f"[Cross-Source Evidence {idx}] (source={source_name}, "
            f"category={chunk['metadata'].get('source_category', '?')}, "
            f"change_id={chunk['metadata'].get('change_id', '?')}, "
            f"discovery={discovery}, "
            f"distance={chunk['distance']:.4f})\n"
            f"{chunk['text'][:800]}"
        )
        chunk_ids.append(chunk["id"])

    formatted = "\n\n".join(evidence_blocks) if evidence_blocks else "No cross-source connections found."

    return {
        "chunks": merged,
        "formatted_context": formatted,
        "chunk_ids": chunk_ids,
        "entities_extracted": len(entity_ids),
        "graph_change_ids": graph_change_ids,
        "discovery_method": "graph_rag",
    }


# Keep backward compatibility
def retrieve_cross_source(change_text: str, source_id: int, top_k: int = 5) -> dict:
    """Backward-compatible alias for retrieve_graph_rag."""
    return retrieve_graph_rag(change_text, source_id, top_k)


# ── Ablation Variants ────────────────────────────────────────────────────────

def _format_chunks(chunks: list, variant: str) -> dict:
    """Format a list of retrieved chunks into a standard result dict."""
    evidence_blocks = []
    chunk_ids = []
    for idx, chunk in enumerate(chunks, 1):
        meta = chunk.get("metadata", {})
        dist = chunk.get("distance")
        dist_str = f"{dist:.4f}" if dist is not None else "n/a"
        evidence_blocks.append(
            f"[Evidence {idx}] (source_id={meta.get('source_id', '?')}, "
            f"category={meta.get('source_category', '?')}, "
            f"change_id={meta.get('change_id', '?')}, "
            f"kind={meta.get('kind', '?')}, "
            f"distance={dist_str})\n"
            f"{chunk['text'][:800]}"
        )
        chunk_ids.append(chunk["id"])
    return {
        "chunks": chunks,
        "formatted_context": "\n\n".join(evidence_blocks) if evidence_blocks else "No relevant evidence found.",
        "chunk_ids": chunk_ids,
        "variant": variant,
    }


def _retrieve_standard_rag(query: str, top_k: int) -> dict:
    """V1: Standard RAG — all chunk kinds, no graph, no cross-source exclusion.

    Simulates a naive RAG baseline that treats all stored content equally.
    Includes 'initial' (full-document) chunks alongside delta chunks.
    """
    chunks = query_similar(query, top_k=top_k)
    return _format_chunks(chunks, "standard_rag")


def _retrieve_delta_rag(query: str, top_k: int) -> dict:
    """V2: DeltaRAG only — delta chunks (added/deleted) only, no graph.

    Grounds retrieval in change-local context rather than full documents,
    avoiding vector dilution from static content.
    """
    added = query_similar(query, top_k=top_k, filters={"kind": "added"})
    deleted = query_similar(query, top_k=top_k, filters={"kind": "deleted"})

    # Merge and re-rank by cosine distance
    merged = sorted(
        added + deleted,
        key=lambda c: c.get("distance") if c.get("distance") is not None else 1.0,
    )
    seen: set = set()
    deduped = []
    for c in merged:
        if c["id"] not in seen:
            seen.add(c["id"])
            deduped.append(c)

    return _format_chunks(deduped[:top_k], "delta_rag")


def _retrieve_graph_only(query: str, source_id: int, top_k: int) -> dict:
    """V3: Graph-RAG only — entity extraction + 2-hop graph traversal, no delta filter.

    Tests the value of structural graph reasoning in isolation.
    Falls back to standard vector search when no entities are found in the query.
    """
    entities = extract_entities(query)
    entity_ids = [e.value for e in entities.entities]

    if not entity_ids:
        # No structured entities in the query — fall back to vector search
        chunks = query_similar(query, top_k=top_k)
        return {
            **_format_chunks(chunks, "graph_rag_only"),
            "entities_extracted": 0,
            "graph_change_ids": [],
            "fallback": True,
        }

    kg = KnowledgeGraph.load_or_create()
    graph_change_ids = kg.get_related_change_ids(entity_ids, max_hops=2)

    seen: set = set()
    graph_chunks: list = []
    for cid in graph_change_ids:
        try:
            c_chunks = query_similar(query, top_k=3, filters={"change_id": cid})
            for c in c_chunks:
                if c["id"] not in seen:
                    seen.add(c["id"])
                    graph_chunks.append(c)
        except Exception:
            pass

    if not graph_chunks:
        # Graph found no reachable chunks — fall back to vector search
        graph_chunks = query_similar(query, top_k=top_k)

    graph_chunks = sorted(
        graph_chunks,
        key=lambda c: c.get("distance") if c.get("distance") is not None else 1.0,
    )[:top_k]

    return {
        **_format_chunks(graph_chunks, "graph_rag_only"),
        "entities_extracted": len(entity_ids),
        "graph_change_ids": graph_change_ids,
        "fallback": False,
    }


def _retrieve_delta_graph(query: str, source_id: int, top_k: int) -> dict:
    """V4/V5: DeltaRAG + Graph-RAG — full production retrieval strategy.

    Combines delta-grounded vector retrieval with knowledge graph traversal
    for cross-source evidence discovery. This is the current production method.
    """
    result = retrieve_graph_rag(query, source_id, top_k)
    result["variant"] = "delta_rag_graph_rag"
    return result


RETRIEVAL_VARIANTS = (
    "standard_rag",
    "delta_rag",
    "graph_rag_only",
    "delta_rag_graph_rag",
    "full_system",
)


def retrieve_by_variant(
    query: str,
    source_id: int = 0,
    top_k: int = 5,
    variant: str = "delta_rag_graph_rag",
) -> dict:
    """Retrieve context using a specified ablation variant.

    Args:
        query: Natural language query or change description.
        source_id: Source ID of the current change (used for cross-source exclusion in
                   Graph-RAG variants). Pass 0 to disable exclusion.
        top_k: Number of results to return.
        variant: Retrieval strategy to use:
            "standard_rag"        — V1: all chunks, no graph (full-doc baseline)
            "delta_rag"           — V2: delta chunks only, no graph
            "graph_rag_only"      — V3: graph traversal only, no delta filter
            "delta_rag_graph_rag" — V4: DeltaRAG + Graph-RAG (production)
            "full_system"         — V5: alias for delta_rag_graph_rag (agents eval'd separately)

    Returns:
        Dict containing:
            chunks          — list of retrieved chunk dicts
            formatted_context — numbered evidence string for LLM prompts
            chunk_ids       — list of chunk IDs for citation
            variant         — the variant name used
    """
    if variant == "standard_rag":
        return _retrieve_standard_rag(query, top_k)
    if variant == "delta_rag":
        return _retrieve_delta_rag(query, top_k)
    if variant == "graph_rag_only":
        return _retrieve_graph_only(query, source_id, top_k)
    if variant in ("delta_rag_graph_rag", "full_system"):
        return _retrieve_delta_graph(query, source_id, top_k)
    raise ValueError(
        f"Unknown variant '{variant}'. Choose from: {', '.join(RETRIEVAL_VARIANTS)}"
    )


def retrieve_recent_tickets(top_k: int = 10) -> str:
    """Retrieve the most recent/critical action tickets from the DB."""
    session = get_session()
    try:
        recs = session.query(Recommendation).order_by(Recommendation.risk_score.desc()).limit(top_k).all()
        if not recs:
            return "No recent action tickets found."
        blocks = []
        for r in recs:
            blocks.append(f"Ticket: [{r.priority.upper()}] {r.title} (Risk: {r.risk_score})\nSummary: {r.summary}")
        return "\n\n".join(blocks)
    finally:
        session.close()


def retrieve_pipeline_stats() -> str:
    """Retrieve operational pipeline stats from DB."""
    session = get_session()
    try:
        active_sources = session.query(Source).filter_by(active=True).count()
        total_changes = session.query(Change).count()
        pending_changes = session.query(Change).filter_by(status="pending").count()
        escalated_changes = session.query(Change).filter_by(status="escalated").count()
        return (
            f"Active Sources Monitored: {active_sources}\n"
            f"Total Changes Detected: {total_changes}\n"
            f"Pending Changes: {pending_changes} | Escalated Changes: {escalated_changes}"
        )
    finally:
        session.close()
