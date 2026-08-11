"""ECI Pipeline Configuration."""
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Load .env file (GROQ_API_KEY, etc.)
load_dotenv(Path(__file__).parent.parent / ".env")

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
SQLITE_DB_PATH = DATA_DIR / "eci.db"
CHROMA_PERSIST_DIR = str(DATA_DIR / "chroma_store")
SOURCES_FILE = PROJECT_ROOT / "config" / "sources.json"
KNOWLEDGE_GRAPH_PATH = DATA_DIR / "knowledge_graph.json"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)

# ── PostgreSQL / SQLite ───────────────────────────────────────────
_WANT_POSTGRES = os.environ.get("USE_SUPABASE", "true").lower() == "true"

SUPABASE_URL = os.environ.get("DATABASE_URL", "").strip()

# Fall back to SQLite when Postgres is requested but no URL is configured.
# Without this, create_engine("") raises at import time and every entry point
# (CLI, API, tests) dies with an error that says nothing about the real cause.
USE_SUPABASE = _WANT_POSTGRES and bool(SUPABASE_URL)

if USE_SUPABASE:
    DATABASE_URL = SUPABASE_URL
else:
    DATABASE_URL = f"sqlite:///{SQLITE_DB_PATH}"
    if _WANT_POSTGRES:
        print(
            "[config] USE_SUPABASE=true but DATABASE_URL is empty — "
            f"falling back to SQLite at {SQLITE_DB_PATH}"
        )

# Load sources from JSON → list of tuples for seed_sources.py
def _load_sources():
    with open(SOURCES_FILE) as f:
        raw = json.load(f)
    return [(s["name"], s["url"], s["fetch_type"], s["category"]) for s in raw if s.get("active", True)]

SOURCES = _load_sources()

# Scraping
REQUEST_TIMEOUT = 30
USER_AGENT = "ECI-Pipeline/1.0 (UIC Research; Android Risk Monitoring)"

# Chunking (the 1600/200 rule)
CHUNK_SIZE = 1600
CHUNK_OVERLAP = 200

# Embedding
EMBEDDING_MODEL = "nomic-ai/nomic-embed-text-v1.5"
EMBEDDING_DIM = 768
EMBEDDING_PREFIX_DOC = "search_document: "
EMBEDDING_PREFIX_QUERY = "search_query: "

# Retrieval
TOP_K_RETRIEVAL = 5

# LLM (Groq)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
LLM_MODEL = "llama-3.1-8b-instant"
LLM_TEMPERATURE = 0.1
LLM_MAX_TOKENS = 1024

# Triage thresholds
RELEVANCE_THRESHOLD = 5
