# ECI Pipeline — Ecosystem Change Intelligence

**From Deltas to Decisions: DeltaRAG + Graph-RAG for Android Risk & Fraud Operations**

> Monitors 10 Android security sources in real-time, detects what changed, and uses a multi-agent AI system to generate evidence-backed **Action Tickets** for fraud and risk operations teams.

---

## What It Does

Financial institutions running Android apps face a critical gap: security-relevant changes are published across 10+ sources — vulnerability databases, developer API docs, OEM bulletins, and policy updates. No analyst can monitor all of them manually. ECI closes this gap automatically.

**The pipeline detects changes → understands context → tells you exactly what to do.**

---

## Architecture

```
10 Monitored Sources (CVE feeds, Android bulletins, OEM patches, policy docs)
        │
        ▼
  [Scraper]  →  SHA-256 snapshot hashing, HTML/JSON ingestion
        │
        ▼
  [Diff Detector]  →  Line-by-line diff, noise filtering, ChangeEvent creation
        │
        ▼
  [Chunker + Embedder]  →  1600-char chunks, nomic-embed-text-v1.5, pgvector storage
        │
        ▼
  [Knowledge Graph]  →  Entity extraction (CVEs, API levels, components), NetworkX graph
        │
        ▼
  [Sentinel Agent]  →  Groq LLM triage — scores relevance (0-10) + risk, escalates or closes
        │
        ▼
  [Coordinator Agent]  →  DeltaRAG + Graph-RAG retrieval → Action Ticket generation
        │
        ▼
  [Next.js Dashboard]  →  Real-time visualization, pipeline runner, graph explorer
```

---

## Core Concepts

### DeltaRAG
Vector embeddings are stored **per diff chunk**, not per full document. Retrieval is grounded on *what actually changed*, avoiding vector dilution from unchanged content. Each chunk is tagged with `kind=added|deleted` for precision filtering.

### Graph-RAG
A NetworkX knowledge graph links extracted entities (CVE IDs, Android API levels, permissions, components) across all 10 sources. The Coordinator Agent performs 2-hop BFS traversal to find cross-source correlations — e.g., a CVE in the CISA feed connecting to an affected component in the Android Security Bulletin.

### Two-Agent System
- **Sentinel Agent** — first-pass LLM triage. Filters noise from signal. Scores every change for relevance and risk. Only high-score changes get escalated.
- **Coordinator Agent** — senior analyst. Uses DeltaRAG + Graph-RAG evidence to write a full Action Ticket with recommended actions, risk score, and owner assignment.

---

## Monitored Sources (10 Feeds)

| # | Source | Category | Priority |
|---|--------|----------|----------|
| 1 | Android Security Bulletin | security_bulletin | 1 |
| 2 | CISA Known Exploited Vulnerabilities | cve_feed | 1 |
| 3 | CISA KEV JSON Feed | cve_feed | 1 |
| 4 | NVD CVE Feed (Android) | cve_feed | 1 |
| 5 | Play Integrity API Docs | developer_docs | 2 |
| 6 | Android API Differences Report | developer_docs | 2 |
| 7 | Android CTS/CDD Changes | developer_docs | 2 |
| 8 | Samsung Mobile Security Bulletin | oem_bulletin | 2 |
| 9 | Pixel Update Bulletin | oem_bulletin | 2 |
| 10 | Google Play Developer Policy | policy_update | 3 |

---

## Project Structure

```
eci-pipeline/
├── main.py                        # Pipeline orchestrator
├── run_pipeline.py                # Real-time backend worker (polls DB, streams logs)
├── requirements.txt
├── .env.example                   # Environment variable template
├── config/
│   ├── settings.py                # All configuration
│   └── sources.json               # 10 monitored source definitions
├── scripts/
│   ├── scraper.py                 # Snapshot fetching (HTML + JSON)
│   ├── diff_detector.py           # Change detection + ChangeEvent generation
│   ├── seed_sources.py            # Source registry seeding
│   ├── init_supabase.py           # One-time DB + pgvector setup
│   └── _temp_fix_jobs.py          # Stuck job recovery utility
├── rag/
│   ├── chunker.py                 # 1600/200 chunking strategy
│   ├── embedder.py                # nomic-embed-text-v1.5 embeddings
│   ├── entity_extractor.py        # NLP entity extraction (CVEs, APIs, components)
│   ├── knowledge_graph.py         # NetworkX graph + 2-hop BFS traversal
│   └── retriever.py               # DeltaRAG + Graph-RAG retrieval
├── agents/
│   ├── sentinel.py                # Triage agent — scores + escalates
│   └── coordinator.py             # Synthesis agent — generates Action Tickets
├── utils/
│   └── db.py                      # SQLAlchemy models
├── evaluation/
│   ├── golden_dataset.py          # Benchmark queries
│   └── test_data.py               # Synthetic test snapshots
└── dashboard/                     # Next.js frontend
    ├── app/
    │   ├── page.js                # Dashboard home
    │   ├── changes/               # Change event browser
    │   ├── tickets/               # Action ticket viewer
    │   ├── sources/               # Source monitor
    │   ├── graph/                 # Knowledge graph visualization
    │   └── api/                   # REST API routes
    ├── components/
    │   ├── PipelineRunner.js      # Real-time pipeline trigger + live log terminal
    │   └── Sidebar.js
    └── lib/
        └── db.js                  # Supabase connection + query functions
```

---

## Quick Start

### 1. Prerequisites

- Python 3.11 (required — Python 3.9 has a PyTorch mutex crash on Mac)
- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- A [Groq](https://console.groq.com) API key (free)

### 2. Clone & Install

```bash
git clone https://github.com/Srivatsa03/ECI-Pipeline.git
cd ECI-Pipeline

# Python dependencies
pip install -r requirements.txt
pip install einops  # required for nomic embedding model

# Dashboard dependencies
cd dashboard && npm install && cd ..
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-us-west-2.pooler.supabase.com:6543/postgres
USE_SUPABASE=true
```

Create `dashboard/.env.local`:

```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-us-west-2.pooler.supabase.com:6543/postgres
```

### 4. Initialize the Database

```bash
python3 scripts/init_supabase.py
```

Creates all tables, enables pgvector, and sets up the HNSW index for cosine similarity search.

### 5. Run the Pipeline

```bash
# All stages end-to-end
python3 main.py --stage all

# Individual stages
python3 main.py --stage seed        # Register 10 sources
python3 main.py --stage scrape      # Fetch live snapshots
python3 main.py --stage diff        # Detect changes
python3 main.py --stage embed       # Chunk + embed into pgvector
python3 main.py --stage graph       # Build knowledge graph
python3 main.py --stage triage      # Sentinel Agent
python3 main.py --stage coordinate  # Coordinator Agent → Action Tickets
python3 main.py --stage report      # Print summary
```

### 6. Start the Dashboard

```bash
# Terminal 1 — Backend worker
python3 run_pipeline.py

# Terminal 2 — Frontend
cd dashboard && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `sources` | 10 monitored feeds |
| `snapshots` | Raw + cleaned content per fetch |
| `changes` | Diffs between snapshots (`pending → triaged/escalated → closed`) |
| `agent_events` | Sentinel + Coordinator outputs per change |
| `recommendations` | Final Action Tickets |
| `embeddings` | Vector chunks (pgvector, 768-dim, HNSW) |
| `pipeline_jobs` | Job queue for dashboard-triggered runs |
| `pipeline_logs` | Streaming stdout logs per job |
| `knowledge_graph_data` | Serialized NetworkX graph (JSONB) |

---

## Action Ticket Format

```json
{
  "title": "Critical CVE in Android Kernel Affecting Device Attestation",
  "priority": "critical",
  "summary": "...",
  "risk_analysis": "...",
  "cross_source_patterns": "Connected to Play Integrity policy change from source #3",
  "recommended_actions": [
    {
      "action": "Update Trivy scanning rules for CVE-2026-XXXX",
      "owner": "Risk Engineering",
      "urgency": "immediate"
    }
  ],
  "risk_score": 9.2,
  "affected_signals": ["device_attestation", "integrity_api"],
  "evidence_ids": ["change_12_chunk_0_added", "change_7_chunk_2_deleted"]
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | Python 3.11 |
| Database | Supabase (PostgreSQL + pgvector) |
| Embeddings | nomic-ai/nomic-embed-text-v1.5 (768-dim) |
| Graph | NetworkX (directed graph, JSONB persistence) |
| LLM | Groq — llama-3.1-8b-instant |
| Frontend | Next.js 14 |
| Deployment | Vercel (frontend) + dedicated server (backend worker) |
| ORM | SQLAlchemy |

---

## Author

**Srivatsa Kamballa** — [GitHub](https://github.com/Srivatsa03) · srivatsakamballa.sk@gmail.com
