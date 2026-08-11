"""Seed the database from the console's exported dataset.

The SENTINEL console ships a curated intelligence feed so it can run with no
database at all. This loads that same feed into Postgres/SQLite so the API and
the console show identical numbers, and so a fresh clone has something to serve
before the live pipeline has ever run.

    node dashboard/scripts/export-dataset.mjs   # refresh data/demo_dataset.json
    python -m scripts.seed_demo_data            # load it

Existing rows are cleared first, so this is safe to re-run.
"""
import json
import sys
from datetime import datetime, timezone

from config.settings import DATA_DIR
from utils.db import (
    AgentEvent, Change, Recommendation, Snapshot, Source, get_session, init_db,
)

DATASET_PATH = DATA_DIR / "demo_dataset.json"


def _parse_ts(value):
    if not value:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)


def seed_demo_data():
    if not DATASET_PATH.exists():
        sys.exit(
            f"[seed] {DATASET_PATH} not found.\n"
            "       Run: node dashboard/scripts/export-dataset.mjs"
        )

    with open(DATASET_PATH) as fh:
        data = json.load(fh)

    init_db()
    session = get_session()

    # Clear in FK-safe order so re-running never violates a constraint.
    for model in (Recommendation, AgentEvent, Change, Snapshot, Source):
        session.query(model).delete()
    session.commit()

    for s in data["sources"]:
        session.add(
            Source(
                id=s["id"],
                name=s["name"],
                url=s["url"],
                fetch_type=s.get("fetch_type", "html"),
                category=s.get("category"),
                active=bool(s.get("active", True)),
                priority=s.get("priority", 5),
            )
        )
    session.flush()

    for c in data["changes"]:
        created = _parse_ts(c.get("created_at"))
        diff = c.get("diff_json") or {}

        # Each change is the delta between two fetches, so it needs a snapshot
        # to point at. We materialise the "after" side only; the pipeline fills
        # both in properly once it has run against live sources.
        snapshot = Snapshot(
            source_id=c["source_id"],
            clean_text=c.get("diff_text"),
            fetched_at=created,
        )
        snapshot.compute_hash()
        session.add(snapshot)
        session.flush()

        session.add(
            Change(
                id=c["id"],
                source_id=c["source_id"],
                new_snapshot_id=snapshot.id,
                diff_json=diff,
                diff_text=c.get("diff_text"),
                status=c.get("status", "pending"),
                created_at=created,
            )
        )
        session.flush()

        session.add(
            AgentEvent(
                change_id=c["id"],
                agent_name="sentinel",
                event_type="triage",
                title=c.get("triage_title"),
                summary=c.get("triage_summary"),
                tags=c.get("tags") or [],
                relevance_score=c.get("relevance_score"),
                local_risk_score=c.get("local_risk_score"),
                confidence=c.get("confidence"),
                risk_domain=c.get("risk_domain"),
                created_at=created,
            )
        )

    for r in data["recommendations"]:
        created = _parse_ts(r.get("created_at"))

        # Every ticket is the output of a Coordinator run, so it gets its own
        # agent event and the ticket points back at it. Without this the audit
        # trail stops at triage and Recommendation.agent_event_id stays null.
        coordinator_event = AgentEvent(
            change_id=r.get("change_id"),
            agent_name="coordinator",
            event_type="recommendation",
            title=r.get("title"),
            summary=r.get("summary"),
            recommended_actions=r.get("recommended_actions") or [],
            evidence_ids=r.get("evidence_citations") or [],
            local_risk_score=r.get("risk_score"),
            created_at=created,
        )
        session.add(coordinator_event)
        session.flush()

        session.add(
            Recommendation(
                id=r["id"],
                change_id=r.get("change_id"),
                agent_event_id=coordinator_event.id,
                title=r.get("title"),
                priority=r.get("priority"),
                summary=r.get("summary"),
                recommended_actions=r.get("recommended_actions") or [],
                owner_suggestion=r.get("owner_suggestion"),
                evidence_citations=r.get("evidence_citations") or [],
                risk_score=r.get("risk_score"),
                created_at=created,
            )
        )

    session.commit()

    counts = {
        "sources": session.query(Source).count(),
        "snapshots": session.query(Snapshot).count(),
        "changes": session.query(Change).count(),
        "agent_events": session.query(AgentEvent).count(),
        "recommendations": session.query(Recommendation).count(),
    }
    session.close()

    print("[seed] loaded " + ", ".join(f"{v} {k}" for k, v in counts.items()))
    return counts


if __name__ == "__main__":
    seed_demo_data()
