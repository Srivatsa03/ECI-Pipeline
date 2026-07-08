# SENTINEL — Ecosystem Change Intelligence Console

A command-deck dashboard for the ECI pipeline. SENTINEL continuously watches the
Android security, API, and policy surface, triages every change with a
multi-agent pipeline (**Scout → Sentinel → Coordinator → Graph → Benchmark**),
and turns it into **evidence-backed action tickets**.

Built with Next.js 16, React 19, Tailwind v4, Recharts, and react-force-graph.

## Runs fully offline

The console serves every panel from an in-process dataset (`lib/data.js`) — **no
Postgres, no Supabase, no network** required to run or demo it. The knowledge
graph (`lib/data/knowledge_graph.json`) and RAG benchmark numbers
(`lib/data/ablation_results.json`) are real artifacts produced by the pipeline.

The only optional external call is the **Threat Assistant** chat, which uses
Groq. Add a key to `.env.local` to enable it:

```bash
GROQ_API_KEY=your_groq_key   # get one free at https://console.groq.com
```

## Getting started

Next.js 16 needs Node **≥ 20.19 or 22.x**. The launcher script auto-selects a
compatible Node (falls back to Homebrew `node@22`) and installs deps:

```bash
./run-demo.sh
```

…or manually:

```bash
npm install
npm run dev
```

Then open **http://localhost:4123** (the launcher's default port).

## What's inside

| Route         | What it shows |
|---------------|---------------|
| `/`           | Command overview — live multi-agent pipeline, KPIs, pipeline posture, priority tickets |
| `/tickets`    | Coordinator action tickets with recommended actions + supporting evidence |
| `/changes`    | Raw change feed with Sentinel triage (relevance / risk / domain) |
| `/graph`      | Interactive knowledge graph (CVEs ↔ components ↔ changes ↔ policy) |
| `/analytics`  | **Benchmarks** — DeltaRAG + Graph-RAG retrieval-quality ablation |
| `/sources`    | Monitored source registry by category |
| `/chat`       | Groq-powered Threat Assistant grounded in the live pipeline state |

## Architecture

```
app/api/*          → route handlers (stats, tickets, changes, graph,
                     benchmarks, evidence, chat, pipeline)
lib/data.js        → offline intelligence dataset (sources, changes,
                     tickets, agent events)
lib/db.js          → data-access layer (same API, now offline)
components/
  LivePipeline.js  → client-side streaming multi-agent run (no backend)
  Sidebar.js       → console navigation + theme toggle
```
