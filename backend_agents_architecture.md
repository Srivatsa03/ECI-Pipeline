# The 5 Core Agents of the ECI Pipeline
**Comprehensive Backend Architecture Guide**

To process raw updates from diverse sources into structured, actionable intelligence, the Ecosystem Change Intelligence (ECI) pipeline relies on a distributed sequence of five specialized internal components (or "Agents"). Each agent is responsible for a distinct phase of the data lifecycle: Ingestion, Detection, Structuring, Triage, and Orchestration.

---

## 1. The Ingestion & Scraping Agent (`scripts/scraper.py`)
### Purpose
The first agent acts as the pipeline's eyes on the external world. It is responsible for continuously monitoring the registered ecosystem endpoints (such as Android Security Bulletins, the CISA KEV Feed, and OEM policy pages) for any updates.

### Mechanics
- **Snapshot Hashing:** Instead of downloading and replacing files blindly, this agent takes a SHA-256 hash snapshot of the current state of a web page or API feed. 
- **Bandwidth Efficiency:** It compares the current hash with the last known snapshot stored in the Postgres database. If the hashes match, it marks the source as `UNCHANGED` and safely halts execution for that source, saving immense bandwidth and API costs.
- **Resiliency:** Handles diverse ingestion methods (HTML scraping, JSON APIs, RSS Feeds).

---

## 2. The Delta Detection Agent (`scripts/diff_detector.py`)
### Purpose
When the Ingestion Agent detects that a monitored source has changed, the Delta Detection Agent steps in to figure out *exactly* what changed. It generates a high-fidelity diff between the old snapshot and the new snapshot.

### Mechanics
- **Line-by-Line Diffing:** It uses Python's precise sequence-matching algorithms to compute the exact `added_lines` and `deleted_lines` between two versions of text.
- **Threshold Pruning:** To prevent noisy updates (like a changing timestamp or an ad banner) from triggering full AI resource utilization, it calculates a structural threshold. If the change is mathematically insignificant, it ignores it.
- **Change Event Generation:** If verified, the delta is packaged into a formal `ChangeEvent` record and pushed into the PostgreSQL tracking table.

---

## 3. The Graph RAG Builder Agent (`rag/knowledge_graph.py`)
### Purpose
Raw text diffs are often missing critical context. An update mentioning "CVE-2026-33634" in isolation is useless. The Graph Builder Agent scans incoming `ChangeEvents` to identify entities and build a structured representation of the ecosystem.

### Mechanics
- **Entity Extraction:** It uses NLP mapping to identify core entities within the text diffs, such as `cve`, `policy_clause`, `component`, or `api_level`.
- **Relationship Linking:** It detects verbs and behaviors (e.g., "CVE-123 *affects* Component-X", or "API-34 *deprecates* API-33") and constructs edges between nodes.
- **Database Persistence:** The finalized Knowledge Graph nodes and edges are persisted, allowing downstream AI agents to query multi-hop relationships seamlessly (e.g., tracing a new CVE back to the exact component an internal application relies upon).

---

## 4. The Sentinel Agent (`agents/sentinel.py`)
### Purpose
The Sentinel is the first true Large Language Model (LLM) agent in the pipeline. It acts as the frontline defense and triage engineer, filtering the "signal from the noise." 

### Mechanics
- **Contextual Triage:** The Sentinel wraps the diff payload into a prompt and asks an LLM (such as `llama-3.1-8b-instant` via the Groq engine) to evaluate the security and operational risk of the change.
- **Scoring System:** It generates two distinct integer scores: a `relevance_score` and a `local_risk_score`.
- **Escalation Protocol:** If the change represents an administrative typo or a low-risk holiday notice, Sentinel assigns a low score and marks it as `TRIAGED` (closed). If the change hits the critical threshold limit, Sentinel marks it as `ESCALATED`, pushing it further down the pipe.

---

## 5. The Coordinator Agent (`agents/coordinator.py`)
### Purpose
The Coordinator is the senior intelligence analyst of the pipeline. It only reviews scenarios that the Sentinel flagged as dangerous or highly relevant. Its job is to generate a comprehensive Action Ticket for human engineers.

### Mechanics
- **Vector Retrieval (RAG):** The Coordinator queries the Supabase `pgvector` database to find past chunks and documentation that are semantically similar to the current escalated incident.
- **Graph Traversal:** It polls the Knowledge Graph to inject structural dependencies (e.g., pulling associated Android API policies linked to a triggered CVE).
- **Ticket Generation:** Armed with historical context and graph intelligence, the Coordinator prompts the LLM to synthesize the final output. It generates a rich, structured Ticket, including an executive `summary`, an explicit `owner_suggestion`, a final calculated `risk_score`, and granular `recommended_actions` (e.g., "Rotate Trivy cloud credentials within 24 hours").
- **Final Closure:** Once the ticket is saved, the event is marked `CLOSED`, and the pipeline resets.
