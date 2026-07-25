-- ============================================================================
-- CLEAN RESET for AI Knowledge Assistant
-- Use when users.id has non-UUID values (e.g. cuid: cmrzdkc...)
--
-- WHAT THIS DOES:
-- 1) Renames broken public.users → users_legacy_backup (data kept, not deleted)
-- 2) Drops incomplete app tables
-- 3) Creates the full correct schema (uuid ids)
--
-- AFTER THIS: run in terminal →  npm run seed:admin
-- Then login again (email admin or Google).
--
-- Paste this ENTIRE file into Supabase SQL Editor and Run once.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

do $do$
begin
  create type public.user_role as enum ('assistant', 'admin');
exception
  when duplicate_object then null;
end
$do$;

-- Drop app tables that depend on users / each other (safe if missing)
drop table if exists public.collection_documents cascade;
drop table if exists public.collections cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop table if exists public.document_chunks cascade;
drop table if exists public.search_logs cascade;
drop table if exists public.knowledge_base cascade;

-- Drop previous users tables (rename kept index names and broke re-runs)
drop table if exists public.users cascade;
drop table if exists public.users_legacy_backup cascade;

-- Fresh users table (UUID — required by this app)
create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text,
  role public.user_role not null default 'assistant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);
create index if not exists users_role_idx on public.users (role);

create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  document_name text not null,
  file_path text not null,
  file_type text not null check (file_type in ('pdf', 'docx')),
  file_size bigint,
  vector_collection_ref text,
  uploaded_by uuid references public.users (id) on delete set null,
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_base_status_idx on public.knowledge_base (status);
create index knowledge_base_uploaded_by_idx on public.knowledge_base (uploaded_by);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_base (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  page_number integer,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index document_chunks_document_id_idx on public.document_chunks (document_id);

create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

create table public.search_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  query_text text not null,
  documents_accessed uuid[] default '{}',
  timestamp timestamptz not null default now(),
  source text,
  had_hits boolean,
  avg_similarity double precision
);

create index search_logs_user_id_idx on public.search_logs (user_id);
create index search_logs_timestamp_idx on public.search_logs (timestamp desc);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null default 'New chat',
  document_id uuid references public.knowledge_base (id) on delete set null,
  collection_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_id_idx
  on public.conversations (user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  confidence double precision,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx
  on public.messages (conversation_id, created_at asc);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index collections_name_unique_idx
  on public.collections (lower(name));

create table public.collection_documents (
  collection_id uuid not null references public.collections (id) on delete cascade,
  document_id uuid not null references public.knowledge_base (id) on delete cascade,
  primary key (collection_id, document_id)
);

create index collection_documents_document_id_idx
  on public.collection_documents (document_id);

alter table public.conversations
  add constraint conversations_collection_id_fkey
  foreign key (collection_id) references public.collections (id) on delete set null;

-- updated_at trigger (use tagged dollar quotes)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists knowledge_base_set_updated_at on public.knowledge_base;
create trigger knowledge_base_set_updated_at
  before update on public.knowledge_base
  for each row execute function public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.document_chunks enable row level security;
alter table public.search_logs enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.collections enable row level security;
alter table public.collection_documents enable row level security;

-- Drop older 3-arg overload if present (avoids PostgREST ambiguity)
drop function if exists public.match_document_chunks(vector, integer, uuid);
drop function if exists public.match_document_chunks(vector, integer, uuid, uuid[]);

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

-- Storage bucket for documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

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
