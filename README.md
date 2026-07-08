# ECI Pipeline — Ecosystem Change Intelligence

**An agentic AI pipeline that watches the live Android security surface, figures
out what actually changed, reasons about how those changes connect, and writes
evidence-backed risk tickets — instead of leaving an analyst to read ten
dashboards by hand.**

Front-ended by **SENTINEL**, a real-time monitoring console.

> Built as an industry capstone with **TransUnion**.

`Python` · `FastAPI` · `PostgreSQL` + `pgvector` · `NetworkX` · `Groq LLM` · `AWS Lambda` · `Next.js` · `Recharts` · `Vercel` · `Prometheus`

---

## The problem

The Android security landscape changes every day — new CVEs, SDK/API changes,
permission shifts, Play policy updates, OEM bulletins. A fraud or risk team
can't watch all of it by hand, and a raw LLM summarizing feeds hallucinates and
gives you no evidence trail.

**ECI turns that firehose into ranked, cited, actionable tickets.**

## How it works

```
 10 live sources ──▶ Scout ──▶ DeltaRAG ──▶ Graph-RAG ──▶ Sentinel ──▶ Coordinator ──▶ Action Tickets
   CVE feeds        (poll +    (what        (how it       (LLM risk     (evidence +      (owner, risk,
   bulletins         hash)     changed)     connects)     triage)       graph traversal)  actions, cites)
   policy pages                                                                                 │
                                                                                                ▼
                                                              SENTINEL console — real-time monitoring
```

The pipeline is a sequence of five specialized agents, each owning one phase of
the data lifecycle:

| # | Agent | File | What it does |
|---|-------|------|--------------|
| 1 | **Scout / Ingestion** | `scripts/scraper.py` | Polls every source. Takes a **SHA-256 snapshot** and compares it to the last one — if nothing changed, it stops early. No wasted bandwidth or LLM calls. Handles HTML, JSON APIs, and RSS. |
| 2 | **Delta Detection (DeltaRAG)** | `scripts/diff_detector.py` | Computes a **line-by-line diff** of what changed, with a significance threshold so noise (timestamps, banners) never triggers the AI. Emits a formal `ChangeEvent`. |
| 3 | **Graph Builder (Graph-RAG)** | `rag/knowledge_graph.py` | Extracts entities (`cve`, `component`, `policy_clause`, `api_level`) from each diff and links them with relationships into a **NetworkX knowledge graph** for multi-hop reasoning. |
| 4 | **Sentinel** | `agents/sentinel.py` | The first LLM agent (Llama-3.1 via **Groq**). Triages each change — assigns a `relevance_score` and `local_risk_score`, then marks it `TRIAGED` (noise) or `ESCALATED` (act on it). Signal from noise. |
| 5 | **Coordinator** | `agents/coordinator.py` | The senior analyst. For escalated items only, it does **vector retrieval** (pgvector) + **graph traversal**, then synthesizes an **Action Ticket**: summary, owner, final risk score, recommended actions — each with evidence citations. |

### The two retrieval ideas

- **DeltaRAG** — don't re-embed and reason over *everything* each run; retrieve
  only over **what changed**. Cheaper, fresher, and it eliminates stale answers.
- **Graph-RAG** — retrieve over a **graph of relationships**, not just semantic
  similarity, so the system can do **multi-hop reasoning**: *"this new CVE →
  affects this component → which this app depends on."* Plain vector RAG can't
  traverse relationships; the graph can.

## SENTINEL — the console

A Next.js 16 dashboard that turns the pipeline output into a monitoring surface.
**It runs fully offline** — every panel is served from an in-process dataset, so
you can demo it from a laptop with **no database, no cloud, no network**.

| Route | Shows |
|-------|-------|
| `/` | Command overview — live multi-agent pipeline run, KPIs, pipeline posture, priority tickets |
| `/tickets` | Coordinator action tickets — recommendations, owner, supporting evidence |
| `/changes` | Raw change feed with Sentinel triage (relevance / risk / domain) |
| `/graph` | Interactive knowledge graph — CVEs ↔ components ↔ changes ↔ policy |
| `/analytics` | **Benchmarks** — DeltaRAG + Graph-RAG retrieval-quality ablation |
| `/sources` | Monitored source registry by category |
| `/chat` | Groq-powered Threat Assistant grounded in live pipeline state |

### Run the console locally

```bash
cd dashboard
./run-demo.sh          # auto-selects Node ≥ 20.19 / 22.x, installs, starts
```

Then open **http://localhost:4123**. To enable the Threat Assistant chat, add a
free [Groq](https://console.groq.com) key to `dashboard/.env.local`:

```bash
GROQ_API_KEY=your_groq_key
```

## Results

Retrieval quality was measured with an **ablation study over 110 gold queries**
(`evaluation/`), comparing Standard RAG, DeltaRAG, Graph-RAG, and the full system:

- **~93% retrieval precision** — P@1 ≈ 0.92, nDCG@5 ≈ 0.95, MRR ≈ 0.95
- **~100% P@1 on multi-hop queries** for the full system — the Graph-RAG payoff
- **Sub-second latency** on the live monitoring dashboard
- **100% of manual pipeline steps automated** (ingest → ticket)
- Least-privilege IAM and secrets management across every cloud service account

## Architecture & stack

- **Retrieval:** `pgvector` for semantic recall, `NetworkX` for relationship reasoning
- **Agents:** Sentinel (risk triage) and Coordinator (evidence + ticketing), both on **Groq** LLMs
- **Serving:** FastAPI backend on **AWS Lambda**, Next.js console on **Vercel**
- **Observability:** Prometheus metrics, structured pipeline logging

## Repository layout

```
ECI-Pipeline/
├── agents/            # Sentinel, Coordinator, Chat (LLM agents)
├── rag/               # chunker, embedder, entity_extractor, knowledge_graph, retriever
├── scripts/           # scraper (Scout), diff_detector (DeltaRAG), seeding, init
├── evaluation/        # ablation, benchmark, golden_dataset, metrics
├── config/            # settings + sources.json (the monitored feeds)
├── utils/             # db + shared helpers
├── dashboard/         # SENTINEL — Next.js console (runs offline)
├── main.py            # pipeline entrypoint
└── run_pipeline.py    # orchestrated end-to-end run
```

## Why it matters

Most "AI over feeds" demos summarize text and hope. ECI is built the way a risk
team actually needs it: **detect precisely what changed, reason over how it
connects, score it, and hand a human a cited ticket they can act on** — with the
retrieval quality measured, not asserted.
