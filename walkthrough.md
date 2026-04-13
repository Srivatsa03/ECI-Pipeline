# Ecosystem Change Intelligence (ECI) Pipeline

## Problem Statement

Financial institutions running Android apps face a critical operational gap: **security-relevant changes** across the Android ecosystem are published across 10+ disparate sources — vulnerability databases, developer API docs, OEM bulletins, and policy updates. No single analyst can monitor all of them simultaneously, and by the time a change is manually discovered, attackers may already be exploiting it.

**ECI closes this gap** by automating the detection, correlation, and triage of ecosystem changes, producing evidence-backed **Action Tickets** that tell fraud/risk operations teams *exactly* what changed, *why* it matters, and *what to do* — with cross-source corroboration.

---

## Formal Framework

ECI operates through three formal stages, grounded in a retrieval-augmented generation (RAG) architecture:

### Stage 1: Delta Detection
For each source $s_i$, the system fetches a new snapshot $s_i(t_k)$, computes a structured diff against the previous snapshot $s_i(t_{k-1})$, and produces a **change event** $\Delta_i(t)$ containing added text, deleted text, change type, and source metadata. This applies HTML cleaning, boilerplate removal, and semantic deduplication before comparison.

### Stage 2: Change-Grounded Retrieval (DeltaRAG)
Change events are chunked (1,600 characters, 200-character overlap), embedded using a task-aware model with `search_document:` prefix optimization, and stored in a vector database with source lineage metadata. At triage time, the Sentinel Agent queries the vector store with the change content, retrieving semantically similar prior changes and related context. **DeltaRAG ensures retrieval is grounded on the delta, not the full document** — avoiding vector dilution.

### Stage 3: Cross-Source Correlation (Graph-RAG)
A **knowledge graph** (NetworkX) links extracted entities (CVEs, components, API levels, permissions) across all sources. When the Coordinator Agent generates an Action Ticket, it performs a **2-hop BFS traversal** from entities in the query to discover related change events across different sources — enabling cross-source corroboration that pure vector search cannot provide.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        ECI Pipeline (Python)                             │
│                                                                          │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌─────────┐ │
│  │  Seed   │→│  Scrape   │→│   Diff     │→│  Chunk +   │→│  Build  │ │
│  │ Sources │  │ Snapshots │  │ Detection  │  │  Embed     │  │  Graph  │ │
│  └─────────┘  └──────────┘  └───────────┘  └────────────┘  └─────────┘ │
│       ↓              ↓             ↓              ↓              ↓       │
│  sources.json    snapshots      changes       ChromaDB      NetworkX     │
│                  (HTML/JSON)    (diffs)       (vectors)     (KG.json)    │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                    Agent Layer (Groq LLM)                         │   │
│  │  ┌──────────────┐           ┌──────────────────┐                  │   │
│  │  │   Sentinel    │    →     │   Coordinator      │                │   │
│  │  │  (Triage)     │          │ (Cross-reference)  │                │   │
│  │  │  Score 0-10   │          │  Graph-RAG query   │                │   │
│  │  │  relevance    │          │  Action Tickets    │                │   │
│  │  └──────────────┘           └──────────────────┘                  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                     │
│                           data/eci.db (SQLite)                           │
│                           data/action_tickets.txt                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                    ECI Dashboard (Next.js)                                │
│                    http://localhost:3000                                  │
│                                                                          │
│  API Routes (better-sqlite3) → reads data/eci.db + knowledge_graph.json │
│                                                                          │
│  Pages: Dashboard | Action Tickets | Knowledge Graph | Sources | Changes │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Monitored Sources (10 feeds)

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

## What We Built — Module by Module

### 1. Source Registry & Scraper
- **[config/sources.json](file:///c:/Users/moksh/Desktop/eci-pipeline/config/sources.json)** — Declarative source registry with URLs, categories, scrape selectors, priorities
- **[scripts/seed_sources.py](file:///c:/Users/moksh/Desktop/eci-pipeline/scripts/seed_sources.py)** — Loads sources into SQLite
- **[scripts/scraper.py](file:///c:/Users/moksh/Desktop/eci-pipeline/scripts/scraper.py)** — Fetches snapshots from each URL, stores raw HTML/JSON with timestamps

### 2. Delta Detection
- **[scripts/diff_detector.py](file:///c:/Users/moksh/Desktop/eci-pipeline/scripts/diff_detector.py)** — Computes structured diffs between consecutive snapshots
  - HTML cleaning, boilerplate removal
  - Outputs `diff_json` with added/deleted lines, change ratio, summary

### 3. DeltaRAG (Chunk + Embed)
- **[rag/chunker.py](file:///c:/Users/moksh/Desktop/eci-pipeline/rag/chunker.py)** — Source-aware chunking
  - **Source context headers**: Prepends `[Source: ... | Category: ... | Type: ...]` to every chunk for embedding disambiguation
  - **JSON-aware chunking**: For structured feeds (CISA, NVD), chunks per-record instead of sliding window
  - 1,600 char chunks, 200 char overlap
- **[rag/embedder.py](file:///c:/Users/moksh/Desktop/eci-pipeline/rag/embedder.py)** — Embeds chunks using `nomic-embed-text-v1.5` with `search_document:` prefix, stores in ChromaDB with full metadata

### 4. Knowledge Graph (Graph-RAG)
- **[rag/entity_extractor.py](file:///c:/Users/moksh/Desktop/eci-pipeline/rag/entity_extractor.py)** — Regex-based extraction of:
  - CVEs (`CVE-\d{4}-\d{4,7}`)
  - API levels (`API level \d+`, `Android \d+`)
  - Permissions (`android.permission.*`)
  - Components (`Wi-Fi`, `Bluetooth`, `kernel`, `GPU`, etc.)
  - Policy clauses, SDK versions, kernel versions
- **[rag/knowledge_graph.py](file:///c:/Users/moksh/Desktop/eci-pipeline/rag/knowledge_graph.py)** — NetworkX directed graph
  - Nodes: entities + change events
  - Edges: `mentions`, `affects`, `references`, `co-occurs`
  - Serialized to [data/knowledge_graph.json](file:///c:/Users/moksh/Desktop/eci-pipeline/data/knowledge_graph.json)
  - **Current stats**: 34 nodes, 58 edges

### 5. Retriever (Graph-RAG)
- **[rag/retriever.py](file:///c:/Users/moksh/Desktop/eci-pipeline/rag/retriever.py)** — Hybrid retrieval combining:
  1. **Vector search** (ChromaDB) — top-k semantic similarity
  2. **Entity extraction** from query → knowledge graph traversal
  3. **2-hop BFS** to discover cross-source change events
  4. **Deduplication** and scoring

### 6. Agent Layer
- **[agents/sentinel.py](file:///c:/Users/moksh/Desktop/eci-pipeline/agents/sentinel.py)** — Sentinel Agent (Groq LLM)
  - Scores each change event for **relevance** (0–10) and **local risk** (0–10)
  - Tags risk domains, confidence levels
  - Filters noise — only escalates relevant changes
- **[agents/coordinator.py](file:///c:/Users/moksh/Desktop/eci-pipeline/agents/coordinator.py)** — Coordinator Agent (Groq LLM)
  - Receives escalated changes + Graph-RAG cross-source evidence
  - Generates structured **Action Tickets** with:
    - Title, summary, priority (critical/high/medium/low)
    - Risk score (0–10)
    - Recommended actions with owners and urgency
    - Evidence citations traced back to source chunks

### 7. Evaluation Framework
- **[evaluation/test_data.py](file:///c:/Users/moksh/Desktop/eci-pipeline/evaluation/test_data.py)** — Synthetic test data for all 10 sources
- **[evaluation/golden_dataset.py](file:///c:/Users/moksh/Desktop/eci-pipeline/evaluation/golden_dataset.py)** — 15 golden queries with expected source mappings
  - **Results**: 93% rank-1 precision, 52% top-5 precision

### 8. Dashboard (Next.js)
- **`dashboard/`** — Premium dark-themed React dashboard
  - [lib/db.js](file:///c:/Users/moksh/Desktop/eci-pipeline/dashboard/lib/db.js) — reads SQLite + knowledge graph JSON via `better-sqlite3`
  - 5 API routes: `/api/{stats,tickets,sources,graph,changes,evidence}`
  - 5 pages with glassmorphism design, gradient accents, Inter font

---

## Dashboard Screenshots

### Pipeline Overview
Stats cards showing monitored sources, detected changes, action tickets, and agent events. Pipeline status breakdown by change lifecycle stage.

![Dashboard Overview](C:/Users/moksh/.gemini/antigravity/brain/70603471-76c0-4e1e-bcf1-84e741b90620/img_dashboard.png)

### Action Tickets
Filterable by priority (Critical/High/Medium/Low). Each ticket shows a pulsing risk score meter, priority badge, and source category tag.

![Action Tickets](C:/Users/moksh/.gemini/antigravity/brain/70603471-76c0-4e1e-bcf1-84e741b90620/img_tickets.png)

### Ticket Detail with Evidence
Clicking a ticket shows the full summary, recommended actions with urgency badges, and **actual source evidence** from the pipeline's database — not raw chunk IDs.

![Ticket Evidence](C:/Users/moksh/.gemini/antigravity/brain/70603471-76c0-4e1e-bcf1-84e741b90620/img_evidence.png)

### Knowledge Graph
Interactive force-directed graph visualization of cross-source entity relationships. Color-coded by type: CVEs (red), Components (blue), Change Events (green), Policy Clauses (amber), API Levels (purple), Permissions (pink). 34 nodes, 58 edges.

![Knowledge Graph](C:/Users/moksh/.gemini/antigravity/brain/70603471-76c0-4e1e-bcf1-84e741b90620/img_graph.png)

### Source Registry
All 10 monitored feeds grouped by category, showing snapshot counts, change counts, and active status.

![Sources](C:/Users/moksh/.gemini/antigravity/brain/70603471-76c0-4e1e-bcf1-84e741b90620/img_sources.png)

### Change Events
All detected changes with Sentinel triage results — relevance and risk scores from the LLM agent.

![Changes](C:/Users/moksh/.gemini/antigravity/brain/70603471-76c0-4e1e-bcf1-84e741b90620/img_changes.png)

---

## Sample Output: Action Ticket

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

## How to Run

### Prerequisites
- Python 3.11+ with `uv` package manager
- Node.js 18+ with `npm`
- `GROQ_API_KEY` environment variable (for LLM agents)

### Full Pipeline
```powershell
cd eci-pipeline

# Run all stages sequentially
uv run main.py --stage all

# Or run individual stages
uv run main.py --stage seed      # 1. Load sources into DB
uv run main.py --stage scrape    # 2. Fetch snapshots
uv run main.py --stage diff      # 3. Detect changes
uv run main.py --stage embed     # 4. Chunk + embed into ChromaDB
uv run main.py --stage graph     # 5. Build knowledge graph
uv run main.py --stage triage    # 6. Sentinel agent scores changes
uv run main.py --stage report    # 7. Coordinator generates action tickets
```

### Dashboard
```powershell
cd dashboard
npm run dev    # → http://localhost:3000
```

### Evaluation
```powershell
uv run python -m evaluation.golden_dataset
```

---

## Project Structure

```
eci-pipeline/
├── main.py                      # CLI entry point for all pipeline stages
├── requirements.txt             # Python dependencies
├── config/
│   ├── settings.py              # Global settings (DB path, model name)
│   └── sources.json             # Source registry (10 feeds)
├── utils/
│   └── db.py                    # SQLite database manager
├── scripts/
│   ├── seed_sources.py          # Load sources → DB
│   ├── scraper.py               # Fetch snapshots from URLs
│   └── diff_detector.py         # Structured diff between snapshots
├── rag/
│   ├── chunker.py               # Source-aware chunking with context headers
│   ├── embedder.py              # nomic-embed-text-v1.5 → ChromaDB
│   ├── retriever.py             # Graph-RAG hybrid retriever
│   ├── entity_extractor.py      # Regex entity extraction for KG
│   └── knowledge_graph.py       # NetworkX knowledge graph
├── agents/
│   ├── sentinel.py              # Triage agent (relevance + risk scoring)
│   └── coordinator.py           # Cross-reference agent (action tickets)
├── evaluation/
│   ├── test_data.py             # Synthetic test data for all sources
│   └── golden_dataset.py        # Retrieval precision evaluation
├── data/                        # Runtime data (generated)
│   ├── eci.db                   # SQLite database
│   ├── knowledge_graph.json     # Serialized NetworkX graph
│   ├── chromadb/                # Vector store
│   └── action_tickets.txt       # Generated recommendations
└── dashboard/                   # Next.js frontend
    ├── app/
    │   ├── page.js              # Dashboard overview
    │   ├── tickets/page.js      # Action tickets + detail modal
    │   ├── graph/page.js        # Interactive knowledge graph
    │   ├── sources/page.js      # Source registry
    │   ├── changes/page.js      # Change events
    │   └── api/                 # API routes (SQLite → JSON)
    ├── components/Sidebar.js    # Navigation sidebar
    └── lib/db.js                # Database reader
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Python 3.11 + uv | Pipeline orchestration |
| Database | SQLite | Source, snapshot, change, agent event storage |
| Vector Store | ChromaDB | Semantic chunk retrieval |
| Embedding | nomic-embed-text-v1.5 | 768-dim embeddings with prefix optimization |
| Knowledge Graph | NetworkX | Cross-source entity linking |
| LLM | Groq (Llama 3) | Sentinel triage + Coordinator ticket generation |
| Frontend | Next.js 16 + React | Dashboard UI |
| Visualization | react-force-graph-2d | Interactive knowledge graph |
| Styling | Tailwind CSS v4 + custom CSS | Dark glassmorphism theme |
