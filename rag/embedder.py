"""Embedding generation and vector storage.

Supports two backends:
  - pgvector (Supabase) — when USE_SUPABASE=True
  - ChromaDB (local)   — when USE_SUPABASE=False

Uses Nomic Embed v1.5 with task-aware prefixes:
  - "search_document: " for indexing chunks
  - "search_query: "    for querying at retrieval time
"""
import hashlib
import math
from config.settings import (
    CHROMA_PERSIST_DIR, EMBEDDING_MODEL, TOP_K_RETRIEVAL,
    USE_SUPABASE, EMBEDDING_DIM
)

COLLECTION_NAME = "eci_delta_chunks"
HASH_DIM = 384  # dimension for hash-based fallback

# ── Embedding Model ──────────────────────────────────────────────

_model = None

def _get_model():
    """Load the sentence-transformer model once."""
    global _model
    if _model is not None:
        return _model

    try:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(EMBEDDING_MODEL, trust_remote_code=True)
        print(f"[EMBED] Loaded {EMBEDDING_MODEL}")
        return _model
    except Exception as e:
        print(f"[EMBED] Could not load model: {e}")
        return None


def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts."""
    model = _get_model()
    if model is not None:
        vecs = model.encode(texts, normalize_embeddings=True)
        return [v.tolist() for v in vecs]
    else:
        # Hash-based fallback
        return [_hash_embed(t) for t in texts]


def _hash_embed(text: str) -> list[float]:
    """Lightweight hash-based embedding fallback."""
    dim = EMBEDDING_DIM
    vec = [0.0] * dim
    words = text.lower().split()
    tokens = words + [f"{words[i]}_{words[i+1]}" for i in range(len(words)-1)]
    for token in tokens:
        h = int(hashlib.md5(token.encode()).hexdigest(), 16)
        idx = h % dim
        sign = 1 if (h // dim) % 2 == 0 else -1
        vec[idx] += sign
    norm = math.sqrt(sum(x*x for x in vec)) or 1.0
    return [x / norm for x in vec]


# ── pgvector Backend (Supabase) ──────────────────────────────────

def _pg_add_chunks(chunks: list) -> int:
    """Insert chunks into the pgvector embeddings table."""
    if not chunks:
        return 0

    from sqlalchemy import text
    from utils.db import engine

    docs = [f"search_document: {c.text}" for c in chunks]
    vectors = _embed_texts(docs)

    with engine.connect() as conn:
        for chunk, vec in zip(chunks, vectors):
            chunk_id = f"change_{chunk.change_id}_chunk_{chunk.index}_{chunk.kind}"
            vec_str = "[" + ",".join(str(v) for v in vec) + "]"

            conn.execute(text("""
                INSERT INTO embeddings (id, change_id, source_id, source_category, source_name, kind, chunk_index, document, embedding, metadata)
                VALUES (:id, :change_id, :source_id, :source_category, :source_name, :kind, :chunk_index, :document, :embedding, CAST(:metadata AS jsonb))
                ON CONFLICT (id) DO UPDATE SET document = :document, embedding = :embedding
            """), {
                "id": chunk_id,
                "change_id": chunk.metadata.get("change_id"),
                "source_id": chunk.metadata.get("source_id"),
                "source_category": chunk.metadata.get("source_category", ""),
                "source_name": chunk.metadata.get("source_name", ""),
                "kind": chunk.kind,
                "chunk_index": chunk.index,
                "document": docs[chunks.index(chunk)],
                "embedding": vec_str,
                "metadata": "{}",
            })
        conn.commit()

    return len(chunks)


def _pg_query_similar(query_text: str, top_k: int = 5, filters: dict = None) -> list[dict]:
    """Query pgvector for similar chunks using cosine distance."""
    from sqlalchemy import text
    from utils.db import engine

    query_doc = f"search_query: {query_text}"
    query_vec = _embed_texts([query_doc])[0]
    vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"

    where_clauses = []
    params = {"vec": vec_str, "limit": top_k}

    if filters:
        if "$and" in filters:
            for f in filters["$and"]:
                for k, v in f.items():
                    where_clauses.append(f"{k} = :{k}")
                    params[k] = v
        else:
            for k, v in filters.items():
                where_clauses.append(f"{k} = :{k}")
                params[k] = v

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sql = f"""
        SELECT id, document, source_id, source_category, source_name,
               change_id, kind, chunk_index, metadata,
               embedding <=> CAST(:vec AS vector) AS distance
        FROM embeddings
        {where_sql}
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :limit
    """

    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).fetchall()

    output = []
    for row in rows:
        doc = row[1]
        if doc and doc.startswith("search_document: "):
            doc = doc[len("search_document: "):]

        output.append({
            "id": row[0],
            "text": doc,
            "metadata": {
                "source_id": row[2],
                "source_category": row[3],
                "source_name": row[4],
                "change_id": row[5],
                "kind": row[6],
                "chunk_index": row[7],
            },
            "distance": float(row[9]) if row[9] is not None else None,
        })

    return output


# ── ChromaDB Backend (Local) ─────────────────────────────────────

def _chroma_get_collection():
    """Get or create the ChromaDB collection."""
    import chromadb
    from chromadb.utils import embedding_functions

    client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)

    try:
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="nomic-ai/nomic-embed-text-v1.5",
            trust_remote_code=True,
        )
        ef(["test"])
    except Exception:
        try:
            ef = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2"
            )
            ef(["test"])
        except Exception:
            from chromadb.api.types import EmbeddingFunction, Documents, Embeddings
            class HashEF(EmbeddingFunction[Documents]):
                def __call__(self, input: Documents) -> Embeddings:
                    return [_hash_embed(d) for d in input]
            ef = HashEF()

    return client.get_or_create_collection(
        name=COLLECTION_NAME, embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )


def _chroma_add_chunks(chunks: list) -> int:
    if not chunks:
        return 0
    collection = _chroma_get_collection()
    ids, documents, metadatas = [], [], []
    for chunk in chunks:
        ids.append(f"change_{chunk.change_id}_chunk_{chunk.index}_{chunk.kind}")
        documents.append(f"search_document: {chunk.text}")
        metadatas.append(chunk.metadata)
    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    return len(ids)


def _chroma_query_similar(query_text: str, top_k: int = 5, filters: dict = None) -> list[dict]:
    collection = _chroma_get_collection()
    query_doc = f"search_query: {query_text}"
    kwargs = {"query_texts": [query_doc], "n_results": min(top_k, collection.count() or 1)}
    if filters:
        kwargs["where"] = filters
    results = collection.query(**kwargs)
    output = []
    if results and results["ids"] and results["ids"][0]:
        for idx in range(len(results["ids"][0])):
            doc = results["documents"][0][idx]
            if doc.startswith("search_document: "):
                doc = doc[len("search_document: "):]
            output.append({
                "id": results["ids"][0][idx],
                "text": doc,
                "metadata": results["metadatas"][0][idx] if results["metadatas"] else {},
                "distance": results["distances"][0][idx] if results["distances"] else None,
            })
    return output


# ── Public API (auto-dispatches to active backend) ───────────────

def add_chunks(chunks: list) -> int:
    """Add chunks to the active vector store."""
    if USE_SUPABASE:
        return _pg_add_chunks(chunks)
    return _chroma_add_chunks(chunks)


def query_similar(query_text: str, top_k: int = TOP_K_RETRIEVAL,
                  filters: dict = None) -> list[dict]:
    """Retrieve top-K similar chunks."""
    if USE_SUPABASE:
        return _pg_query_similar(query_text, top_k, filters)
    return _chroma_query_similar(query_text, top_k, filters)


def get_collection_stats() -> dict:
    """Get stats about the vector store."""
    if USE_SUPABASE:
        from sqlalchemy import text
        from utils.db import engine
        with engine.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM embeddings")).scalar()
        return {"total_chunks": count, "backend": "pgvector"}
    else:
        collection = _chroma_get_collection()
        return {"total_chunks": collection.count(), "backend": "chromadb"}


# Keep backward compatibility
def get_collection():
    """Legacy: returns ChromaDB collection or None for pgvector."""
    if USE_SUPABASE:
        return None
    return _chroma_get_collection()
