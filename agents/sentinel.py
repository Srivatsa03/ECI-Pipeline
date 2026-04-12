"""Sentinel Agent — first-pass triage of change events.

Reads a structured change description and outputs:
  - relevance_score (0-10)
  - local_risk_score (0-10)
  - risk_domain classification
  - summary and recommended_actions
  - is_relevant (bool) for escalation decision
"""
import json
from groq import Groq
from config.settings import GROQ_API_KEY, LLM_MODEL, LLM_TEMPERATURE, RELEVANCE_THRESHOLD
from utils.db import get_session, AgentEvent

SENTINEL_SYSTEM_PROMPT = """You are a cybersecurity risk analyst specializing in Android ecosystem monitoring for fraud operations teams at financial institutions.

Your role: Analyze a detected platform change and determine if it is relevant to fraud risk and digital trust operations.

You MUST respond with ONLY a valid JSON object. No preamble, no explanation, no markdown.

JSON Schema:
{
  "title": "Short title describing the change (max 80 chars)",
  "summary": "2-3 sentence explanation of what changed and why it matters",
  "relevance_score": <integer 0-10, how relevant to fraud/risk operations>,
  "local_risk_score": <integer 0-10, how severe the potential impact>,
  "risk_domain": "<one of: device_trust | api_integrity | policy_enforcement | vulnerability_exposure | not_relevant>",
  "is_relevant": <true if relevance_score >= 5, else false>,
  "tags": ["list", "of", "relevant", "tags"],
  "recommended_actions": ["action 1", "action 2"],
  "confidence": <float 0.0-1.0, your confidence in this assessment>,
  "rationale": "Brief explanation of your scoring logic"
}

Scoring guidelines:
- relevance_score 8-10: Directly impacts fraud signals, device trust, or enforcement logic
- relevance_score 5-7: Indirectly affects risk posture, worth monitoring
- relevance_score 1-4: Minor or cosmetic change, low operational impact
- relevance_score 0: Completely irrelevant (navigation changes, formatting)

- local_risk_score 8-10: Active exploitation or critical signal degradation
- local_risk_score 5-7: Moderate impact on detection or enforcement
- local_risk_score 1-4: Low impact, advisory only

risk_domain values:
- device_trust: Changes to attestation, device integrity, hardware signals
- api_integrity: API deprecations, new requirements, breaking changes
- policy_enforcement: App store policy changes, compliance requirements
- vulnerability_exposure: New CVEs, patches, exploit indicators
- not_relevant: Cosmetic or unrelated changes"""


def triage_change(change, source_name: str) -> dict | None:
    """Run Sentinel triage on a single change event.

    Args:
        change: Change ORM object
        source_name: Name of the source for context

    Returns:
        Parsed JSON output from the Sentinel, or None on failure.
    """
    if not GROQ_API_KEY:
        print("  [SENTINEL] No GROQ_API_KEY set. Skipping.")
        return None

    client = Groq(api_key=GROQ_API_KEY)

    # Build the change description for the agent
    diff_summary = change.diff_json.get("summary", "") if change.diff_json else ""
    change_ratio = change.diff_json.get("change_ratio", 0) if change.diff_json else 0

    user_prompt = f"""Analyze this detected platform change:

SOURCE: {source_name}
CATEGORY: {change.source.category if change.source else 'unknown'}
CHANGE SUMMARY: {diff_summary}
CHANGE RATIO: {change_ratio}

CHANGE CONTENT:
{(change.diff_text or '')[:3000]}

Respond with ONLY the JSON object."""

    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": SENTINEL_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=LLM_TEMPERATURE,
            max_tokens=1024,
        )

        raw_text = response.choices[0].message.content.strip()

        # Try to extract JSON from response
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        result = json.loads(raw_text)

        # Enforce is_relevant based on threshold
        result["is_relevant"] = result.get("relevance_score", 0) >= RELEVANCE_THRESHOLD

        return result

    except json.JSONDecodeError as e:
        print(f"  [SENTINEL] JSON parse failed: {e}")
        print(f"  Raw output: {raw_text[:200]}")
        return None
    except Exception as e:
        print(f"  [SENTINEL] Error: {e}")
        return None


def run_sentinel():
    """Run Sentinel triage on all pending changes."""
    session = get_session()
    pending = session.query(
        __import__("utils.db", fromlist=["Change"]).Change
    ).filter_by(status="pending").all()

    if not pending:
        print("[SENTINEL] No pending changes to triage.")
        session.close()
        return

    triaged, escalated, failed = 0, 0, 0

    for change in pending:
        source = change.source
        print(f"  Triaging change #{change.id} from {source.name if source else '?'}...")

        result = triage_change(change, source.name if source else "Unknown")

        if result is None:
            failed += 1
            continue

        # Store agent event
        event = AgentEvent(
            change_id=change.id,
            agent_name="sentinel",
            event_type="triage",
            title=result.get("title", ""),
            summary=result.get("summary", ""),
            tags=result.get("tags", []),
            relevance_score=result.get("relevance_score", 0),
            local_risk_score=result.get("local_risk_score", 0),
            confidence=result.get("confidence", 0),
            risk_domain=result.get("risk_domain", "not_relevant"),
            recommended_actions=result.get("recommended_actions", []),
            raw_output=result,
        )
        session.add(event)

        # Update change status
        if result.get("is_relevant"):
            change.status = "escalated"
            escalated += 1
        else:
            change.status = "triaged"
        triaged += 1

    session.commit()
    session.close()
    print(f"[SENTINEL] {triaged} triaged, {escalated} escalated, {failed} failed.")


if __name__ == "__main__":
    run_sentinel()
