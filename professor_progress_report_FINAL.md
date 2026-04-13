# Ecosystem Change Intelligence (ECI) Pipeline
## Professor Progress Report

**To:** [Professor's Name]
**From:** Srivatsa Kamballa
**Date:** March 2026
**Subject:** Progress Report — ECI Pipeline: Architecture, Backend Agents, Cloud Deployment, and Real-Time Orchestration

---

## Executive Summary

The Ecosystem Change Intelligence (ECI) pipeline addresses a critical operational gap faced by financial institutions running Android applications: security-relevant changes across the Android ecosystem are continuously published across 10+ disparate sources — vulnerability databases, developer API docs, OEM bulletins, and policy updates — with no automated system to detect, correlate, or act on them in a timely manner.

Over the course of this project, we have designed and built a fully functional, end-to-end pipeline that automates this process. The system has been successfully evolved from a locally-bound prototype into a robust, cloud-ready distributed architecture featuring multi-agent AI triage, vector database retrieval, knowledge graph construction, and a Vercel-deployed real-time dashboard. The core mechanics — including AI-driven change detection, multi-agent analysis, vector ingestion, structured knowledge graph generation, and remote Web UI orchestration — are now stable and demonstrably working.

---

## 1. Problem Statement and Motivation

Financial institutions running Android apps face a critical operational gap: security-relevant changes across the Android ecosystem are published across 10+ disparate sources — vulnerability databases, developer API docs, OEM bulletins, and policy updates. No single analyst can monitor all of them simultaneously, and by the time a change is manually discovered, attackers may already be exploiting it.

**ECI closes this gap** by automating the detection, correlation, and triage of ecosystem changes, producing evidence-backed **Action Tickets** that tell fraud and risk operations teams exactly what changed, why it matters, and what to do — with cross-source corroboration.

---

## 2. Formal Framework

ECI operates through three formal stages, grounded in a retrieval-augmented generation (RAG) architecture:

### Stage 1: Delta Detection
For each source, the system fetches a new snapshot, computes a structured diff against the previous snapshot, and produces a **change event** containing added text, deleted text, change type, and source metadata. This applies HTML cleaning, boilerplate removal, and semantic deduplication before comparison.

### Stage 2: Change-Grounded Retrieval (DeltaRAG)
Change events are chunked (1,600 characters, 200-character overlap), embedded using a task-aware model with `search_document:` prefix optimization, and stored in a vector database with source lineage metadata. At triage time, the Sentinel Agent queries the vector store with the change content, retrieving semantically similar prior changes and related context. **DeltaRAG ensures retrieval is grounded on the delta, not the full document** — avoiding vector dilution.

### Stage 3: Cross-Source Correlation (Graph-RAG)
A **knowledge graph** (NetworkX) links extracted entities (CVEs, components, API levels, permissions) across all sources. When the Coordinator Agent generates an Action Ticket, it performs a **2-hop BFS traversal** from entities in the query to discover related change events across different sources — enabling cross-source corroboration that pure vector search cannot provide.

---

## 3. Monitored Sources (10 Feeds)

| # | Source | Category | Priority |
|---|--------|----------|----------|
| 1 | Android Security Bulletin | security_bulletin | 1 |
| 2 | CISA Known Exploited Vulnerabilities | cve_feed | 1 |
| 3 | Play Integrity API Docs | developer_docs | 2 |
| 4 | SafetyNet Attestation Docs | developer_docs | 2 |
| 5 | Google Play Policy Updates | policy_update | 3 |
| 6 | NVD CVE Feed (Android) | cve_feed | 1 |
| 7 | Android CTS/CDD Changes | developer_docs | 2 |
| 8 | Samsung Mobile Security | oem_bulletin | 2 |
| 9 | Pixel Update Bulletin | oem_bulletin | 2 |
| 10 | Google Play Console Updates | policy_update | 3 |

---

## 4. Backend Architecture: The 5 Core Agents

To process raw updates from diverse sources into structured, actionable intelligence, the ECI pipeline relies on a distributed sequence of five specialized internal agents. Each agent is responsible for a distinct phase of the data lifecycle: Ingestion, Detection, Structuring, Triage, and Orchestration.

### Agent 1 — Ingestion & Scraping (`scripts/scraper.py`)

The first agent acts as the pipeline's eyes on the external world. It continuously monitors the registered ecosystem endpoints for any updates.

- **Snapshot Hashing:** Takes a SHA-256 hash snapshot of the current state of each web page or API feed.
- **Bandwidth Efficiency:** Compares the current hash against the last known snapshot stored in the database. If the hashes match, it marks the source as `UNCHANGED` and halts execution for that source, saving bandwidth and API costs.
- **Resiliency:** Handles diverse ingestion methods — HTML scraping, JSON APIs, and RSS Feeds.

### Agent 2 — Delta Detection (`scripts/diff_detector.py`)

When the Ingestion Agent detects a change, this agent determines exactly what changed by generating a high-fidelity diff between the old and new snapshot.

- **Line-by-Line Diffing:** Uses Python's sequence-matching algorithms to compute exact `added_lines` and `deleted_lines` between two versions of text.
- **Threshold Pruning:** Calculates a structural threshold to prevent noisy updates (e.g., a changing timestamp or ad banner) from triggering full AI resource utilization.
- **Change Event Generation:** If verified, the delta is packaged into a formal `ChangeEvent` record and pushed into the PostgreSQL tracking table.

### Agent 3 — Graph RAG Builder (`rag/knowledge_graph.py`)

Raw text diffs are often missing critical context. An update mentioning "CVE-2026-33634" in isolation is useless without knowing what it affects. This agent scans incoming change events to identify entities and build a structured knowledge graph.

- **Entity Extraction:** Uses NLP mapping to identify core entities such as `cve`, `policy_clause`, `component`, or `api_level`.
- **Relationship Linking:** Detects verbs and behaviors (e.g., "CVE-123 *affects* Component-X") and constructs edges between nodes.
- **Database Persistence:** Finalized Knowledge Graph nodes and edges are persisted, allowing downstream agents to query multi-hop relationships seamlessly. **Current stats: 34 nodes, 58 edges.**

### Agent 4 — Sentinel Agent (`agents/sentinel.py`)

The Sentinel is the first Large Language Model (LLM) agent in the pipeline. It acts as the frontline triage engineer, filtering signal from noise.

- **Contextual Triage:** Wraps the diff payload into a prompt and queries an LLM (`llama-3.1-8b-instant` via Groq) to evaluate the security and operational risk of the change.
- **Scoring System:** Generates two distinct integer scores: a `relevance_score` and a `local_risk_score`, both on a 0–10 scale.
- **Escalation Protocol:** Low-risk changes (administrative typos, holiday notices) are marked `TRIAGED` and closed. Changes that hit the critical threshold are marked `ESCALATED` and passed to the Coordinator.

### Agent 5 — Coordinator Agent (`agents/coordinator.py`)

The Coordinator is the senior intelligence analyst of the pipeline. It reviews only scenarios the Sentinel flagged as dangerous or highly relevant, then generates a comprehensive Action Ticket for human engineers.

- **Vector Retrieval (RAG):** Queries the Supabase `pgvector` database to find past chunks and documentation semantically similar to the current escalated incident.
- **Graph Traversal:** Polls the Knowledge Graph to inject structural dependencies (e.g., pulling associated Android API policies linked to a triggered CVE).
- **Ticket Generation:** Armed with historical context and graph intelligence, the Coordinator prompts the LLM to synthesize the final output — including an executive `summary`, `owner_suggestion`, final `risk_score`, and granular `recommended_actions` (e.g., "Rotate Trivy cloud credentials within 24 hours").
- **Final Closure:** Once the ticket is saved, the event is marked `CLOSED` and the pipeline resets.

---

## 5. Cloud Architecture and Infrastructure Updates

### 5.1 Vector Database Migration (ChromaDB → Supabase pgvector)

Initially, the pipeline utilized local ChromaDB instances for semantic retrieval. We have since fully migrated to a cloud-based **Supabase (PostgreSQL with `pgvector`)** architecture to enable stateless execution across distributed environments.

- Identified and resolved complex abstraction leaks within SQLAlchemy's named-parameter bindings that conflicted with PostgreSQL double-colon typecasts (e.g., `:metadata::jsonb`).
- Transitioned ingestion and query logic to explicit ANSI `CAST()` operations, guaranteeing stable cross-platform serialization for both 768-dimensional embedding matrices and complex change metadata.

### 5.2 Distributed Serverless Decoupling

Because the frontend (Next.js) is deployed as serverless functions on Vercel, it cannot natively spawn long-running Python AI processes. We engineered a completely decoupled event-driven architecture to bridge this gap:

- **Database as Message Broker:** Provisioned `pipeline_jobs` and `pipeline_logs` tables within Supabase to act as a stateful event bus.
- **Continuous Execution Worker:** Developed a fault-tolerant Python background service (`run_pipeline.py`) that operates on dedicated compute resources, constantly monitoring the Supabase queue, picking up `pending` jobs, and executing the heavy AI agent tasks (Sentinel and Coordinator).
- **Knowledge Graph Cloud Migration:** Migrated Knowledge Graph storage from a static local JSON file to dynamic querying from the centralized Postgres database, ensuring Vercel serverless nodes can visualize multi-dimensional CVE and policy correlations from anywhere.

### 5.3 Real-Time Telemetry and Dashboard Integration

To preserve system visibility for analysts despite the backend decoupling, we engineered a real-time monitoring interface within the dashboard:

- **Real-Time Pipeline Runner:** Added an interactive UI component to trigger pipeline triage remotely via the Vercel frontend.
- **Live Log Streaming:** The backend Python worker uses `subprocess.stdout` buffering and UTF-8 encoding normalization to capture console output. These logs are simultaneously written to Supabase tracking tables.
- **WebSocket/Polling Sync:** The Next.js dashboard uses low-latency synchronization to retrieve these logs, rendering a live, SSH-like terminal directly in the browser so analysts can watch changes being chunked, graphed, and triaged in real time.

### 5.4 Resiliency and Operational Hardening

- **Windows Host Encoding Compatibility:** Resolved `cp1252` terminal encoding crashes during complex table rendering by injecting `PYTHONIOENCODING=utf-8` into worker sub-processes, preventing Unicode formatting failures.
- **Job State Recovery:** Added maintenance mechanics (`_temp_fix_jobs`) to gracefully trap runtime exceptions, reset execution locks, and ensure the UI job queue never deadlocks.

---

## 6. System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        ECI Pipeline (Python)                             │
│                                                                          │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌─────────┐ │
│  │  Seed   │→ │  Scrape  │→ │   Diff    │→ │  Chunk +   │→ │  Build  │ │
│  │ Sources │  │Snapshots │  │ Detection │  │   Embed    │  │  Graph  │ │
│  └─────────┘  └──────────┘  └───────────┘  └────────────┘  └─────────┘ │
│       ↓              ↓             ↓              ↓              ↓       │
│  sources.json    snapshots      changes       pgvector       NetworkX    │
│                  (HTML/JSON)    (diffs)       (Supabase)     (KG nodes)  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                    Agent Layer (Groq LLM)                         │   │
│  │  ┌──────────────┐           ┌──────────────────┐                  │   │
│  │  │   Sentinel   │    →      │   Coordinator    │                  │   │
│  │  │  (Triage)    │           │ (Cross-reference) │                  │   │
│  │  │  Score 0-10  │           │  Graph-RAG query  │                  │   │
│  │  │  relevance   │           │  Action Tickets   │                  │   │
│  │  └──────────────┘           └──────────────────┘                  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                     │
│                         Supabase PostgreSQL                              │
│                         (pipeline_jobs, pipeline_logs, action_tickets)   │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                    ECI Dashboard (Next.js / Vercel)                      │
│                                                                          │
│  API Routes → Supabase + Knowledge Graph                                 │
│  Pages: Dashboard | Action Tickets | Knowledge Graph | Sources | Changes │
│  Real-Time: Live log streaming terminal via polling/WebSocket sync       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Evaluation Results

- **Retrieval Precision (Rank-1):** 93%
- **Retrieval Precision (Top-5):** 52%
- Evaluated against a golden dataset of 15 queries with expected source mappings across all 10 monitored feeds.

---

## 8. Sample Output: Action Ticket

```
[CRITICAL] CVE-2025-0096 and CVE-2025-0097 Patched — Critical Vulnerabilities
  Risk Score: 9.5
  Owner: Risk Engineering
  Summary: Two critical vulnerabilities (CVE-2025-0096 and CVE-2025-0097)
           have been patched in Android 14 and 15, affecting the Wi-Fi
           subsystem and GPU driver. Public exploit code is available,
           and exploitation has been detected in targeted attacks.

  Recommended Actions:
    [IMMEDIATE] Prioritize patching of Android 14/15 devices to prevent
                remote code execution (Owner: Risk Engineering)
    [THIS_WEEK] Monitor for additional exploitation attempts and update
                mitigation strategies (Owner: Fraud Modeling)

  Evidence: Android Security Bulletin, CISA KEV, Samsung Bulletin, Pixel Bulletin
```

---

## 9. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Python 3.11 + uv | Pipeline orchestration |
| Database | Supabase (PostgreSQL) | Source, snapshot, change, agent event storage |
| Vector Store | pgvector (Supabase) | Semantic chunk retrieval (768-dim) |
| Embedding | nomic-embed-text-v1.5 | Embeddings with prefix optimization |
| Knowledge Graph | NetworkX | Cross-source entity linking |
| LLM | Groq (Llama 3.1) | Sentinel triage + Coordinator ticket generation |
| Frontend | Next.js + React (Vercel) | Dashboard UI |
| Visualization | react-force-graph-2d | Interactive knowledge graph |
| Styling | Tailwind CSS v4 | Dark glassmorphism theme |

---

## 10. Next Steps

- Fine-tune the Sentinel Agent's evaluation thresholds to reduce false negatives on medium-risk changes.
- Expand CISA and AOSP ingestion vectors to cover additional source categories.
- Improve top-5 retrieval precision (currently 52%) through reranking or hybrid BM25 + vector search.
- Add automated alerting when a Critical-priority Action Ticket is generated.
