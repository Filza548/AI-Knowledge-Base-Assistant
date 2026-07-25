-- ============================================================================
-- PART C — grants + RPC (no $$ function body — avoids Supabase editor bug)
-- Run AFTER Part B. Paste ONLY this block.
-- ============================================================================

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on routines to postgres, anon, authenticated, service_role;

-- Similarity search RPC (language sql — no plpgsql $$ body)
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  filter_document_id uuid default null,
  filter_document_ids uuid[] default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  page_number integer,
  document_name text,
  similarity float
)
language sql
stable
as $fn$
  select
    c.id,
    c.document_id,
    c.content,
    c.page_number,
    kb.document_name,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.knowledge_base kb on kb.id = c.document_id
  where kb.status = 'ready'
    and c.embedding is not null
    and (filter_document_id is null or c.document_id = filter_document_id)
    and (
      filter_document_ids is null
      or cardinality(filter_document_ids) = 0
      or c.document_id = any (filter_document_ids)
    )
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$fn$;
