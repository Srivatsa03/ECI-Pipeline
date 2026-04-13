# Ecosystem Change Intelligence (ECI) Pipeline
## Project Development Update

**To:** [Professor's Name]  
**From:** Srivatsa Kamballa  
**Date:** March 2026  
**Subject:** Progress Report on ECI Pipeline Architecture, Cloud Deployment, and Real-Time Orchestration  

---

### Executive Summary
Over the past phase of development, we have successfully transformed the Ecosystem Change Intelligence (ECI) pipeline from a locally-bound prototype into a robust, cloud-ready, and resilient distributed architecture. The pipeline now features seamless multi-agent change analysis, robust vector-database interactions via Supabase PostgreSQL, and a Vercel-deployed Next.js presentation layer featuring real-time, event-driven orchestration.

### 1. Vector Database Integration and Typecasting Fixes
Initially, the pipeline utilized local ChromaDB instances for semantic retrieval augmented generation (RAG). We have since fully migrated to a cloud-based **Supabase (PostgreSQL with `pgvector`)** architecture to allow for stateless execution. 
* Identified and resolved complex abstraction leaks within SQLAlchemy's named-parameter bindings that conflicted with PostgreSQL double-colon typecasts (e.g., `:metadata::jsonb`).
* Transitioned the ingestion and query logic to utilize explicit, standard ANSI `CAST()` operations, guaranteeing stable cross-platform serialization for both embedding matrices (768 dimensions) and complex change metadata.

### 2. Distributed Cloud Architecture and Serverless Decoupling
Because the frontend (React/Next.js) is deployed as serverless functions on Vercel, it cannot natively spawn long-running, monolithic Python AI processes. To bridge this gap, we engineered a completely decoupled event-driven architecture.
* **Database as Message Broker:** We provisioned `pipeline_jobs` and `pipeline_logs` tables within Supabase to act as a stateful event bus.
* **Continuous Execution Worker:** We developed a fault-tolerant Python background service (`run_pipeline.py`) that operates on dedicated computing resources. This "worker" constantly monitors the Supabase queue, picks up jobs flagged as `pending`, and executes the heavy AI agent tasks (Sentinel and Coordinator).
* **Knowledge Graph Cloud Migration:** We migrated the Knowledge Graph's storage model from a static local JSON file (`data/knowledge_graph.json`) to dynamic querying from the centralized Postgres database, ensuring Vercel serverless nodes can accurately visualize multi-dimensional CVE and policy correlations anywhere in the world.

### 3. Real-Time Telemetry and UI Integration
To preserve system visibility for analysts despite the backend decoupling, we engineered a real-time monitoring interface directly within the dashboard.
* **Real-time Pipeline Runner Component:** Added a user-facing interactive component to trigger pipeline triage remotely via the Vercel frontend. 
* **Live Log Streaming:** As the backend Python worker executes local child-processes, it utilizes `subprocess.stdout` buffering and UTF-8 encoding normalization to catch console output. These logs are simultaneously written to the Supabase tracking tables.
* **WebSocket/Polling Sync:** The Next.js dashboard uses low-latency synchronization to retrieve these logs, rendering a live, SSH-like sliding terminal directly in the browser so users can watch changes being chunked, graphed, and triaged in real-time.

### 4. Resiliency and Operational Hardening
* **Windows Host Encoding Compatibility:** We discovered that native terminal encoding on certain hosts (Windows `cp1252`) crashed python agent executions during complex table rendering (due to undefined ASCII mapping). We successfully injected `PYTHONIOENCODING=utf-8` environmental variables into the worker sub-processes, preventing Unicode formatting crashes.
* **Job State Recovery:** Added maintenance mechanics (`_temp_fix_jobs`) to gracefully trap runtime exceptions, properly identifying failure cascades and resetting execution locks to ensure the UI queue never deadlocks.

### Conclusion & Next Steps
The core pipeline mechanics—including AI-driven CVE change detection, multi-agent triage, vector ingestion, structured knowledge graph generation, and remote Web UI orchestration—are now fundamentally stable and demonstrably working. The next phase will focus on fine-tuning the Sentinel Agent's evaluation thresholds and potentially expanding the CISA and AOSP ingestion vectors.
