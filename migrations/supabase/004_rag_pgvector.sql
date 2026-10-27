-- ==============================================================================
-- VivPay RAG Knowledge & Vector Embeddings — Supabase PostgreSQL Schema
-- Migration: 004_rag_pgvector.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Enable pgvector extension
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------------------------
-- 2. Document Chunks Table (768-dimensional embeddings for Gemini text-embedding-004)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.statement_documents(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_customer_id ON public.document_chunks(customer_id);

-- HNSW Vector index for fast approximate nearest neighbor cosine search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_cosine
    ON public.document_chunks
    USING hnsw (embedding vector_cosine_ops);

-- GIN index for lexical full-text hybrid matching
CREATE INDEX IF NOT EXISTS idx_chunks_fts
    ON public.document_chunks
    USING gin (to_tsvector('english', content));

-- Enable RLS
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own document chunks"
    ON public.document_chunks FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert their own document chunks"
    ON public.document_chunks FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own document chunks"
    ON public.document_chunks FOR UPDATE
    USING (auth.uid() = customer_id)
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their own document chunks"
    ON public.document_chunks FOR DELETE
    USING (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- 3. Stored RPC Function for Vector Similarity Search with Customer Scoping
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_document_chunks (
    query_embedding vector(768),
    match_threshold float DEFAULT 0.40,
    match_count int DEFAULT 10,
    filter_customer_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    customer_id uuid,
    chunk_index int,
    title text,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_customer_id uuid;
BEGIN
    -- If filter_customer_id is provided, enforce that non-service callers can only query their own data
    IF filter_customer_id IS NOT NULL THEN
        target_customer_id := filter_customer_id;
    ELSE
        target_customer_id := auth.uid();
    END IF;

    -- Prevent cross-tenant information leakage
    IF auth.uid() IS NOT NULL AND target_customer_id <> auth.uid() THEN
        RAISE EXCEPTION 'Access denied: Customer cannot query vector chunks across tenants.';
    END IF;

    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.customer_id,
        dc.chunk_index,
        dc.title,
        dc.content,
        dc.metadata,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    WHERE dc.customer_id = target_customer_id
      AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
