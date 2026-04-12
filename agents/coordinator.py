"""Coordinator Agent — synthesizes insights and generates Action Tickets.

Only processes changes that were escalated by the Sentinel Agent.
Uses DeltaRAG context retrieval + cross-source evidence for Graph-RAG.
"""
import json
from groq import Groq
from config.settings import GROQ_API_KEY, LLM_MODEL, LLM_TEMPERATURE
from utils.db import get_session, Change, AgentEvent, Recommendation
from rag.retriever import retrieve_context, retrieve_graph_rag

COORDINATOR_SYSTEM_PROMPT = """You are a senior digital risk intelligence analyst. You receive escalated platform changes that have been flagged as relevant by a triage system.

Your job: Analyze the change in depth using the provided evidence context, identify cross-source patterns, and produce an actionable recommendation (Action Ticket) for the fraud operations team.

You MUST respond with ONLY a valid JSON object. No preamble, no explanation, no markdown.

JSON Schema:
{
  "title": "Concise title for the Action Ticket (max 100 chars)",
  "priority": "<one of: critical | high | medium | low>",
  "summary": "3-5 sentence analysis of the change, its impact, and cross-source connections",
  "risk_analysis": "Detailed explanation of how this change affects fraud detection or trust signals",
  "cross_source_patterns": "Any connections found to changes in other ecosystem sources",
  "recommended_actions": [
    {
      "action": "Specific action to take",
      "owner": "Team or role responsible (e.g., Fraud Modeling, Risk Engineering)",
      "urgency": "immediate | this_week | next_sprint | monitor"
    }
  ],
  "evidence_summary": "Brief summary of what evidence supports this recommendation",
  "evidence_ids": ["list of evidence IDs used"],
  "risk_score": <float 0.0-10.0, final composite risk score>,
  "confidence": <float 0.0-1.0>,
  "affected_signals": ["list of fraud signals or trust mechanisms affected"],
  "tags": ["categorization", "tags"]
}

Priority guidelines:
- critical: Active exploitation, immediate signal degradation, enforcement bypass
- high: Significant impact within days, requires prompt action
- medium: Important but not urgent, plan response within current sprint
- low: Advisory, monitor for future developments

When analyzing evidence, cite specific evidence IDs to maintain traceability."""


def coordinate_change(change, sentinel_event: AgentEvent) -> dict | None:
    """Run Coordinator analysis on an escalated change.

    Args:
        change: Change ORM object
        sentinel_event: The Sentinel's triage output for context

    Returns:
        Parsed JSON output from the Coordinator, or None on failure.
    """
    if not GROQ_API_KEY:
        print("  [COORDINATOR] No GROQ_API_KEY set. Skipping.")
        return None

    client = Groq(api_key=GROQ_API_KEY)

    # Retrieve DeltaRAG context (same-source related changes)
    delta_context = retrieve_context(
        change.diff_text or "",
        top_k=5,
    )

    # Retrieve cross-source context (Graph-RAG)
    cross_context = retrieve_graph_rag(
        change.diff_text or "",
        source_id=change.source_id,
        top_k=3,
    )

    # Include graph metadata in prompt
    graph_info = ""
    if cross_context.get("entities_extracted", 0) > 0:
        graph_info = f"\nEntities extracted: {cross_context['entities_extracted']}"
        if cross_context.get("graph_change_ids"):
            graph_info += f"\nGraph-connected changes: {cross_context['graph_change_ids']}"

    user_prompt = f"""Analyze this escalated platform change and produce an Action Ticket.

=== SENTINEL TRIAGE SUMMARY ===
Title: {sentinel_event.title}
Summary: {sentinel_event.summary}
Relevance: {sentinel_event.relevance_score}/10
Risk: {sentinel_event.local_risk_score}/10
Domain: {sentinel_event.risk_domain}

=== CHANGE CONTENT ===
Source: {change.source.name if change.source else 'Unknown'}
Category: {change.source.category if change.source else 'unknown'}
{(change.diff_text or '')[:2000]}

=== RELATED EVIDENCE (DeltaRAG) ===
{delta_context['formatted_context'][:2000]}

=== CROSS-SOURCE EVIDENCE (Graph-RAG) ===
{cross_context['formatted_context'][:1500]}
{graph_info}

Respond with ONLY the JSON object."""

    try:
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": COORDINATOR_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=LLM_TEMPERATURE,
            max_tokens=2048,
        )

        raw_text = response.choices[0].message.content.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        result = json.loads(raw_text)

        # Attach evidence chunk IDs
        result["evidence_ids"] = (
            delta_context["chunk_ids"] + cross_context["chunk_ids"]
        )

        return result

    except json.JSONDecodeError as e:
        print(f"  [COORDINATOR] JSON parse failed: {e}")
        return None
    except Exception as e:
        print(f"  [COORDINATOR] Error: {e}")
        return None


def run_coordinator():
    """Run Coordinator on all escalated changes."""
    session = get_session()

    # Find escalated changes that don't yet have coordinator events
    escalated = session.query(Change).filter_by(status="escalated").all()

    if not escalated:
        print("[COORDINATOR] No escalated changes to process.")
        session.close()
        return

    processed, failed = 0, 0

    for change in escalated:
        # Get the Sentinel event for this change
        sentinel_event = (
            session.query(AgentEvent)
            .filter_by(change_id=change.id, agent_name="sentinel")
            .first()
        )
        if not sentinel_event:
            continue

        # Check if already processed by coordinator
        existing = (
            session.query(AgentEvent)
            .filter_by(change_id=change.id, agent_name="coordinator")
            .first()
        )
        if existing:
            continue

        print(f"  Coordinating change #{change.id}: {sentinel_event.title}...")
        result = coordinate_change(change, sentinel_event)

        if result is None:
            failed += 1
            continue

        # Store coordinator event
        event = AgentEvent(
            change_id=change.id,
            agent_name="coordinator",
            event_type="recommendation",
            title=result.get("title", ""),
            summary=result.get("summary", ""),
            tags=result.get("tags", []),
            relevance_score=sentinel_event.relevance_score,
            local_risk_score=result.get("risk_score", 0),
            confidence=result.get("confidence", 0),
            risk_domain=sentinel_event.risk_domain,
            recommended_actions=result.get("recommended_actions", []),
            evidence_ids=result.get("evidence_ids", []),
            raw_output=result,
        )
        session.add(event)

        # Create Action Ticket (Recommendation)
        rec = Recommendation(
            change_id=change.id,
            agent_event_id=None,  # will update after flush
            title=result.get("title", ""),
            priority=result.get("priority", "medium"),
            summary=result.get("summary", ""),
            recommended_actions=result.get("recommended_actions", []),
            owner_suggestion=_extract_primary_owner(result),
            evidence_citations=result.get("evidence_ids", []),
            risk_score=result.get("risk_score", 0),
        )
        session.add(rec)

        change.status = "closed"
        processed += 1

    session.commit()
    session.close()
    print(f"[COORDINATOR] {processed} processed, {failed} failed.")


def _extract_primary_owner(result: dict) -> str:
    """Extract the primary owner from recommended actions."""
    actions = result.get("recommended_actions", [])
    if actions and isinstance(actions[0], dict):
        return actions[0].get("owner", "Risk Engineering")
    return "Risk Engineering"


if __name__ == "__main__":
    run_coordinator()
