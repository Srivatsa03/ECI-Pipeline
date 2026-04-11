"""Detect meaningful changes between consecutive snapshots."""
import difflib
import json
from utils.db import get_session, Source, Snapshot, Change


def compute_diff(old_text: str, new_text: str) -> dict:
    """Compute structured diff between two text versions.

    Returns:
        {
            "added": [lines added],
            "deleted": [lines deleted],
            "summary": "human-readable diff summary",
            "change_ratio": float  # 0-1 how much changed
        }
    """
    old_lines = old_text.splitlines() if old_text else []
    new_lines = new_text.splitlines() if new_text else []

    matcher = difflib.SequenceMatcher(None, old_lines, new_lines)
    ratio = 1.0 - matcher.ratio()  # change_ratio: 0 = identical, 1 = completely different

    added = []
    deleted = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "insert":
            added.extend(new_lines[j1:j2])
        elif tag == "delete":
            deleted.extend(old_lines[i1:i2])
        elif tag == "replace":
            deleted.extend(old_lines[i1:i2])
            added.extend(new_lines[j1:j2])

    # Filter out trivial lines (very short, whitespace-only)
    added = [l for l in added if len(l.strip()) > 10]
    deleted = [l for l in deleted if len(l.strip()) > 10]

    summary_parts = []
    if added:
        summary_parts.append(f"{len(added)} lines added")
    if deleted:
        summary_parts.append(f"{len(deleted)} lines deleted")

    return {
        "added": added,
        "deleted": deleted,
        "summary": "; ".join(summary_parts) if summary_parts else "No meaningful changes",
        "change_ratio": round(ratio, 4),
    }


def build_diff_text(diff_data: dict) -> str:
    """Build a human-readable diff text for embedding and agent consumption."""
    parts = []

    if diff_data["added"]:
        parts.append("=== ADDED CONTENT ===")
        parts.extend(diff_data["added"][:50])  # Cap at 50 lines

    if diff_data["deleted"]:
        parts.append("\n=== DELETED CONTENT ===")
        parts.extend(diff_data["deleted"][:50])

    return "\n".join(parts) if parts else ""


def detect_changes(min_change_ratio: float = 0.001):
    """Compare latest snapshots against previous ones to find changes."""
    session = get_session()
    sources = session.query(Source).filter_by(active=True).all()
    changes_found = 0

    for source in sources:
        snapshots = (
            session.query(Snapshot)
            .filter_by(source_id=source.id)
            .order_by(Snapshot.fetched_at.desc())
            .limit(2)
            .all()
        )

        if len(snapshots) < 2:
            # First snapshot or only one — treat as initial ingestion
            if len(snapshots) == 1:
                snap = snapshots[0]
                # Check if we already have a change for this
                existing = session.query(Change).filter_by(
                    new_snapshot_id=snap.id
                ).first()
                if existing:
                    continue

                # Create an "initial" change event
                diff_data = {
                    "added": (snap.clean_text or "").splitlines()[:100],
                    "deleted": [],
                    "summary": "Initial ingestion",
                    "change_ratio": 1.0,
                }
                change = Change(
                    source_id=source.id,
                    prev_snapshot_id=None,
                    new_snapshot_id=snap.id,
                    diff_json=diff_data,
                    diff_text=build_diff_text(diff_data),
                    status="pending",
                )
                session.add(change)
                changes_found += 1
                print(f"  {source.name}: INITIAL ({len(diff_data['added'])} lines)")
            continue

        new_snap, old_snap = snapshots[0], snapshots[1]

        # Skip if we already diffed these
        existing = session.query(Change).filter_by(
            prev_snapshot_id=old_snap.id,
            new_snapshot_id=new_snap.id,
        ).first()
        if existing:
            continue

        diff_data = compute_diff(old_snap.clean_text, new_snap.clean_text)

        if diff_data["change_ratio"] < min_change_ratio:
            print(f"  {source.name}: below threshold ({diff_data['change_ratio']})")
            continue

        diff_text = build_diff_text(diff_data)
        if not diff_text.strip():
            continue

        change = Change(
            source_id=source.id,
            prev_snapshot_id=old_snap.id,
            new_snapshot_id=new_snap.id,
            diff_json=diff_data,
            diff_text=diff_text,
            status="pending",
        )
        session.add(change)
        changes_found += 1
        print(f"  {source.name}: CHANGE ({diff_data['summary']})")

    session.commit()
    session.close()
    print(f"[DIFF] {changes_found} change events created.")
    return changes_found


if __name__ == "__main__":
    detect_changes()
