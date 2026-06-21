-- Switch embedding dimension from 1536 (OpenAI) to 768 (Gemini)

-- Drop the old HNSW index (dimension-specific)
drop index if exists public.document_chunks_embedding_idx;

-- Clear any existing embeddings (old ones were 1536-dim, now invalid)
truncate table public.document_chunks;

-- Change the column type to 768 dimensions
alter table public.document_chunks
  alter column embedding type vector(768);

-- Recreate the HNSW index for the new dimension
create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Update the match function to accept 768-dim query vectors
create or replace function public.match_document_chunks(
  query_embedding vector(768),
  match_document_id uuid,
  match_user_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  chunk_index int,
  similarity float
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.content,
    document_chunks.chunk_index,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where document_chunks.document_id = match_document_id
    and document_chunks.user_id = match_user_id
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;