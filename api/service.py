"""Query layer for the ECI API.

Every function here is the server-side twin of a reader in
`dashboard/lib/db.js`, so the console gets byte-compatible payloads whether it
is running against the offline dataset or this service.
"""
import json
import re
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from config.settings import DATA_DIR, KNOWLEDGE_GRAPH_PATH
from utils.db import AgentEvent, Change, Recommendation, Snapshot, Source

CHUNK_ID_RE = re.compile(r"^change_(\d+)_chunk_\d+_(?:added|deleted)$")
ABLATION_PATH = DATA_DIR / "ablation_results.json"

# The Sentinel agent writes one triage event per change; the console renders
# those fields inline on the change row.
_TRIAGE_AGENT = "sentinel"


# ── Stats ─────────────────────────────────────────────────────────

def get_stats(db: Session) -> Dict[str, int]:
    counts = dict(
        db.query(Change.status, func.count(Change.id)).group_by(Change.status).all()
    )
    return {
        "sources": db.query(func.count(Source.id)).scalar() or 0,
        "totalChanges": sum(counts.values()),
        "pending": counts.get("pending", 0),
        "escalated": counts.get("escalated", 0),
        "triaged": counts.get("triaged", 0),
        "closed": counts.get("closed", 0),
        "agentEvents": db.query(func.count(AgentEvent.id)).scalar() or 0,
        "actionTickets": db.query(func.count(Recommendation.id)).scalar() or 0,
    }


# ── Sources ───────────────────────────────────────────────────────

def get_sources(db: Session) -> List[Dict[str, Any]]:
    change_counts = dict(
        db.query(Change.source_id, func.count(Change.id)).group_by(Change.source_id).all()
    )
    snapshot_counts = dict(
        db.query(Snapshot.source_id, func.count(Snapshot.id))
        .group_by(Snapshot.source_id)
        .all()
    )
    rows = db.query(Source).order_by(Source.priority.asc(), Source.name.asc()).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "url": s.url,
            "category": s.category,
            "fetch_type": s.fetch_type,
            "priority": s.priority,
            "active": bool(s.active),
            "snapshot_count": snapshot_counts.get(s.id, 0),
            "change_count": change_counts.get(s.id, 0),
        }
        for s in rows
    ]


# ── Changes ───────────────────────────────────────────────────────

def _triage_by_change(db: Session, change_ids: List[int]) -> Dict[int, AgentEvent]:
    """Latest Sentinel triage event per change, keyed by change id."""
    if not change_ids:
        return {}
    events = (
        db.query(AgentEvent)
        .filter(
            AgentEvent.change_id.in_(change_ids),
            AgentEvent.agent_name == _TRIAGE_AGENT,
        )
        .order_by(AgentEvent.id.asc())
        .all()
    )
    # Later events win, matching "most recent triage" semantics.
    return {e.change_id: e for e in events}


def _serialize_change(row: Change, source: Optional[Source], triage: Optional[AgentEvent]) -> Dict[str, Any]:
    diff = row.diff_json or {}
    return {
        "id": row.id,
        "source_id": row.source_id,
        "source_name": source.name if source else None,
        "source_category": source.category if source else None,
        "status": row.status,
        "diff_text": row.diff_text,
        "diff_json": {
            "summary": diff.get("summary"),
            "change_ratio": diff.get("change_ratio"),
            "added_lines": diff.get("added_lines") or [],
            "deleted_lines": diff.get("deleted_lines") or [],
        },
        "tags": (triage.tags if triage and triage.tags else []),
        "created_at": row.created_at,
        "triage_title": triage.title if triage else None,
        "triage_summary": triage.summary if triage else None,
        "relevance_score": triage.relevance_score if triage else None,
        "local_risk_score": triage.local_risk_score if triage else None,
        "risk_domain": triage.risk_domain if triage else None,
        "confidence": triage.confidence if triage else None,
    }


def get_changes(db: Session, limit: int = 200) -> List[Dict[str, Any]]:
    rows = db.query(Change).order_by(Change.id.desc()).limit(limit).all()
    sources = {s.id: s for s in db.query(Source).all()}
    triage = _triage_by_change(db, [r.id for r in rows])
    return [_serialize_change(r, sources.get(r.source_id), triage.get(r.id)) for r in rows]


# ── Tickets ───────────────────────────────────────────────────────

def get_tickets(db: Session) -> List[Dict[str, Any]]:
    rows = (
        db.query(Recommendation, Change, Source)
        .outerjoin(Change, Recommendation.change_id == Change.id)
        .outerjoin(Source, Change.source_id == Source.id)
        .order_by(Recommendation.risk_score.desc().nullslast())
        .all()
    )
    return [
        {
            "id": rec.id,
            "title": rec.title,
            "summary": rec.summary,
            "priority": rec.priority,
            "riskScore": rec.risk_score,
            "sourceName": src.name if src else None,
            "sourceCategory": src.category if src else None,
            "changeId": rec.change_id,
            "recommendedActions": rec.recommended_actions or [],
            "ownerSuggestion": rec.owner_suggestion,
            "evidenceCitations": rec.evidence_citations or [],
            "createdAt": rec.created_at,
        }
        for rec, _chg, src in rows
    ]


# ── Evidence ──────────────────────────────────────────────────────

def get_evidence(db: Session, chunk_ids: List[str]) -> List[Dict[str, Any]]:
    """Resolve `change_<id>_chunk_<n>_<added|deleted>` citations to source text."""
    change_ids = set()
    for cid in chunk_ids:
        match = CHUNK_ID_RE.match(cid)
        if match:
            change_ids.add(int(match.group(1)))
    if not change_ids:
        return []

    rows = db.query(Change).filter(Change.id.in_(change_ids)).all()
    sources = {s.id: s for s in db.query(Source).all()}

    results = []
    for row in rows:
        diff = row.diff_json or {}
        added = diff.get("added_lines") or []
        deleted = diff.get("deleted_lines") or []

        evidence_text = ""
        if added:
            evidence_text = "\n".join(added[:8])
            if len(added) > 8:
                evidence_text += "\n... (+{} more lines)".format(len(added) - 8)
        if not evidence_text:
            evidence_text = (row.diff_text or "")[:500] or "No content available"

        src = sources.get(row.source_id)
        results.append(
            {
                "changeId": row.id,
                "sourceName": src.name if src else None,
                "sourceCategory": src.category if src else None,
                "evidenceText": evidence_text,
                "addedCount": len(added),
                "deletedCount": len(deleted),
            }
        )
    return results


# ── Knowledge graph and benchmarks ────────────────────────────────

def _read_json(path, default):
    try:
        with open(path) as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return default


def get_graph() -> Dict[str, Any]:
    """Raw graph as written by rag/knowledge_graph.py. Styling stays client-side."""
    raw = _read_json(KNOWLEDGE_GRAPH_PATH, {})
    nodes = [
        {"id": n.get("id"), "node_type": n.get("node_type") or "unknown"}
        for n in raw.get("nodes", [])
        if n.get("id")
    ]
    edge_rows = raw.get("edges") or raw.get("links") or []
    edges = [
        {
            "source": e.get("source"),
            "target": e.get("target"),
            "relation": e.get("relation") or "unknown",
        }
        for e in edge_rows
        if e.get("source") and e.get("target")
    ]
    return {"nodes": nodes, "edges": edges}


VARIANT_LABELS = {
    "standard_rag": "Standard RAG",
    "delta_rag": "DeltaRAG",
    "graph_rag_only": "Graph-RAG",
    "delta_rag_graph_rag": "DeltaRAG + Graph",
    "full_system": "Full System",
}


def get_benchmarks() -> Dict[str, Any]:
    """RAG ablation results produced by evaluation/ablation.py.

    Reshaped into {metadata, variants, byType} to match exactly what the
    console's offline reader emits. The raw file is keyed by variant name,
    which is awkward to chart; both data sources now hand the page the same
    already-flattened structure.
    """
    raw = _read_json(ABLATION_PATH, {})
    results = raw.get("results") or {}

    variants = [
        {
            "key": key,
            "label": VARIANT_LABELS.get(key, key),
            "p_at_1": v.get("mean_p_at_1"),
            "ndcg_at_5": v.get("mean_ndcg_at_5"),
            "mrr": v.get("mrr"),
            "map": v.get("map_score"),
            "recall_at_5": v.get("mean_r_at_5"),
            "freshness": v.get("mean_freshness"),
            "stale_rate": v.get("mean_stale_rate"),
            "false_alarm_rejection": v.get("false_alarm_rejection_rate"),
            "num_queries": v.get("num_queries"),
        }
        for key, v in results.items()
    ]

    full = results.get("full_system") or results.get("delta_rag_graph_rag") or {}
    # false_alarm queries have no expected source category, so every retrieval
    # metric short-circuits to 0.0 for them. Charting that reads as a total
    # failure when it actually measures nothing; their real score is the
    # rejection rate. evaluation/metrics.py now drops them at the source, and
    # this filter covers result files generated before that fix.
    by_type = [
        {
            "type": qtype.replace("_", " "),
            "p_at_1": m.get("mean_p_at_1"),
            "ndcg_at_5": m.get("mean_ndcg_at_5"),
            "mrr": m.get("mrr"),
            "count": m.get("count"),
        }
        for qtype, m in (full.get("by_type") or {}).items()
        if qtype != "false_alarm"
    ]

    return {"metadata": raw.get("metadata") or {}, "variants": variants, "byType": by_type}


# ── Chat context ──────────────────────────────────────────────────

def get_chat_context(db: Session) -> Dict[str, str]:
    stats = get_stats(db)
    active_sources = (
        db.query(func.count(Source.id)).filter(Source.active.is_(True)).scalar() or 0
    )
    stats_text = (
        "Active Sources Monitored: {}\n"
        "Total Changes Detected: {}\n"
        "Pending Changes: {} | Escalated Changes: {}\n"
        "Agent Events: {} | Action Tickets: {}"
    ).format(
        active_sources,
        stats["totalChanges"],
        stats["pending"],
        stats["escalated"],
        stats["agentEvents"],
        stats["actionTickets"],
    )

    tickets = get_tickets(db)[:10]
    tickets_text = (
        "\n\n".join(
            "Ticket: [{}] {} (Risk: {}, Source: {})\nSummary: {}".format(
                (t["priority"] or "").upper(),
                t["title"],
                t["riskScore"],
                t["sourceName"],
                t["summary"],
            )
            for t in tickets
        )
        or "No action tickets found."
    )

    changes = get_changes(db, limit=12)
    changes_text = (
        "\n\n".join(
            "[change_{}] ({}, {}, status: {})\n{}".format(
                c["id"],
                c["source_name"],
                c["source_category"],
                c["status"],
                (c["diff_text"] or "No diff text")[:300],
            )
            for c in changes
        )
        or "No recent changes found."
    )

    return {"stats": stats_text, "ticketsText": tickets_text, "changesText": changes_text}
