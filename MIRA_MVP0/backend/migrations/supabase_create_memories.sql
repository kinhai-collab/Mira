-- Supabase migration: create facts table for memory service (pgvector)
-- Run this in your Supabase SQL editor or with psql using your Supabase DB connection string.

-- OPTIONAL: if you plan to use pgvector server-side similarity, enable extension:
-- CREATE EXTENSION IF NOT EXISTS vector;
-- If you enable pgvector, consider storing `embedding` as type vector instead of jsonb.

-- NOTE: this migration uses the pgvector extension to store embeddings as a
-- native vector type so the database can index and perform k-NN searches.
-- Make sure your Supabase project allows enabling extensions and you have
-- sufficient privileges. If you prefer not to enable pgvector, keep the
-- previous JSONB-based migration instead.

-- Enable the vector extension (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- IMPORTANT: set VECTOR_DIM to the embedding dimension produced by your
-- chosen embedding model. Common values: 1536 (many OpenAI models), 384
-- (some smaller models). If unsure, call your embedding API once and check
-- the returned vector length, then replace <<VECTOR_DIM>> below.

-- Facts table (stores user facts/preferences). Embeddings are stored as
-- pgvector `vector(VECTOR_DIM)` for efficient server-side nearest neighbor
-- search.
CREATE TABLE IF NOT EXISTS public.facts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT,
  metadata JSONB,
  embedding vector(<<VECTOR_DIM>>),
  importance INTEGER DEFAULT 1,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Index on user_id for fast per-user filtering
CREATE INDEX IF NOT EXISTS idx_facts_user_id ON public.facts (user_id);

-- Vector index for approximate nearest-neighbor search using ivfflat.
-- Tune `lists` according to dataset size (larger = faster search but more memory).
CREATE INDEX IF NOT EXISTS facts_embedding_ivfflat ON public.facts USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Notes:
-- - Replace <<VECTOR_DIM>> above with your model's embedding dimensionality.
-- - To migrate existing JSONB-encoded embeddings to pgvector you may need a
--   one-time migration to cast JSON arrays into the vector column format.
-- - To run this file via psql (PowerShell example):
--     psql "postgres://<DB_USER>:<DB_PASS>@<DB_HOST>:5432/<DB_NAME>" -f .\\backend\\migrations\\supabase_create_memories.sql
-- - Or paste the contents into the Supabase SQL editor (Project -> SQL) and run.
