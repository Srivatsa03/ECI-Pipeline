-- Enable pgvector on first boot of the Postgres container.
-- SQLAlchemy creates the tables; this only has to provide the extension.
CREATE EXTENSION IF NOT EXISTS vector;
