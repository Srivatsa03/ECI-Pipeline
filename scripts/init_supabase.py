"""Initialize Supabase PostgreSQL with pgvector extension and embeddings table.

Run this once before the first pipeline run:
    uv run python scripts/init_supabase.py
"""
from sqlalchemy import text
from utils.db import engine, init_db
from config.settings import USE_SUPABASE, EMBEDDING_DIM


def init_supabase():
    if not USE_SUPABASE:
        print("[INIT] USE_SUPABASE is False — using local SQLite. Nothing to do.")
        return

    # 1. Create core ORM tables (sources, snapshots, changes, agent_events, recommendations)
    init_db()

    # 2. Enable pgvector extension and create embeddings table
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
        print("[INIT] pgvector extension enabled")

        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS embeddings (
                id TEXT PRIMARY KEY,
                change_id INTEGER,
                source_id INTEGER,
                source_category TEXT,
                source_name TEXT,
                kind TEXT,
                chunk_index INTEGER,
                document TEXT,
                embedding vector({EMBEDDING_DIM}),
                metadata JSONB DEFAULT '{{}}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        conn.commit()
        print(f"[INIT] embeddings table created (vector dim={EMBEDDING_DIM})")

        # Create HNSW index for fast cosine similarity search
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS embeddings_cosine_idx
            ON embeddings USING hnsw (embedding vector_cosine_ops)
        """))
        conn.commit()
        print("[INIT] HNSW index created for cosine similarity")

    print("[INIT] Supabase initialization complete ✓")

    # 3. Create tables for Real-Time Pipeline Runner and Graph
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pipeline_jobs (
                id SERIAL PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT now(),
                started_at TIMESTAMPTZ,
                finished_at TIMESTAMPTZ
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pipeline_logs (
                id SERIAL PRIMARY KEY,
                job_id INTEGER REFERENCES pipeline_jobs(id),
                log_line TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS knowledge_graph_data (
                id INTEGER PRIMARY KEY DEFAULT 1,
                graph_json JSONB NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        conn.commit()
        print("[INIT] Pipeline jobs, logs, and knowledge_graph_data tables created")


if __name__ == "__main__":
    init_supabase()
