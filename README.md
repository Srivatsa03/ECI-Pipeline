# ECI Pipeline

**Ecosystem Change Intelligence for Android risk and fraud operations.**
DeltaRAG + Graph-RAG that watches live security feeds and writes evidence-backed risk tickets, instead of leaving an analyst to read 10 dashboards by hand.

> Built as an industry capstone with TransUnion.

## What it does

The Android security landscape changes daily: new CVEs, SDK updates, permission shifts, deprecations. ECI ingests **10 live security and CVE data sources**, detects what actually changed (DeltaRAG), reasons over how those changes connect (Graph-RAG over a NetworkX graph), and produces **Action Tickets** that a fraud or risk team can act on, each one backed by cross-source evidence rather than a model's hunch.

## How it works

```
10 live sources ──> ingest ──> DeltaRAG (what changed) ──> Graph-RAG (how it connects)
                                                                  │
        Sentinel Agent (scores each change for risk)  <───────────┘
                                                                  │
        Coordinator Agent (cross-source evidence) ──> Action Tickets
                                                                  │
                                       Next.js dashboard (sub-second monitoring)
```

- **Retrieval:** pgvector for semantic recall, NetworkX for relationship reasoning, Groq LLM agents for synthesis.
- **Agents:** a Sentinel Agent scores changes for risk; a Coordinator Agent assembles evidence and drafts tickets.
- **Serving:** FastAPI backend on AWS Lambda, Next.js dashboard on Vercel.

## Results

- **93% retrieval precision** across the ingested sources.
- **100% of manual pipeline steps eliminated** via Python and Bash automation.
- **Sub-second latency** on the live monitoring dashboard.
- Least-privilege IAM and secrets management across every cloud service account.

## Stack

`Python` · `FastAPI` · `PostgreSQL` · `pgvector` · `NetworkX` · `Groq LLM` · `AWS Lambda` · `Next.js` · `Vercel` · `Prometheus`
