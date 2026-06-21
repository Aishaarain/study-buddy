-- Switch embedding dimension from 768 (Gemini) to 1024 (Cohere embed-english-v3.0)

drop index if exists public.document_chunks_embedding_idx;

truncate table public.document_chunks;

alter table public.document_chunks
  alter column embedding type vector(1024);

create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_document_chunks(
  query_embedding vector(1024),
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