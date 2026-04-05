-- kind. AI — pgvector schema
-- Run this in Supabase SQL editor after the main supabase/schema.sql file.

create extension if not exists vector;

create table if not exists public.kin_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  chunk_text text not null,
  embedding vector(1536),
  updated_at timestamptz not null default now()
);

create unique index if not exists kin_embeddings_source_unique_idx
on public.kin_embeddings (source_type, source_id);

create index if not exists kin_embeddings_embedding_idx
on public.kin_embeddings
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

alter table public.kin_embeddings enable row level security;

drop policy if exists "Authenticated can read embeddings" on public.kin_embeddings;
create policy "Authenticated can read embeddings"
on public.kin_embeddings
for all
to authenticated
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create or replace function public.match_embeddings(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  source_type text,
  source_id text,
  chunk_text text,
  similarity float
)
language sql
stable
as $$
  select
    id,
    source_type,
    source_id,
    chunk_text,
    1 - (embedding <=> query_embedding) as similarity
  from public.kin_embeddings
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
