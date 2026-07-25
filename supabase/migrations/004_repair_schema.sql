-- ============================================================================
-- REPAIR SCRIPT — run once in Supabase SQL Editor
-- Project must match NEXT_PUBLIC_SUPABASE_URL in .env.local
-- Fixes: users.id text→uuid, missing password_hash, missing chat tables
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

do $$ begin
  create type public.user_role as enum ('viewer', 'admin');
exception
  when duplicate_object then null;
end $$;

-- Ensure public.users exists with the columns this app needs
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Drop FKs that block changing users.id type (re-added below if needed)
do $$
declare
  r record;
begin
  for r in
    select conname, conrelid::regclass as tbl
    from pg_constraint
    where confrelid = 'public.users'::regclass
      and contype = 'f'
  loop
    execute format('alter table %s drop constraint if exists %I', r.tbl, r.conname);
  end loop;
end $$;

-- Convert users.id from text → uuid when needed (values must be valid UUIDs)
do $$
declare
  id_type text;
begin
  select data_type into id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'users'
    and column_name = 'id';

  if id_type = 'text' or id_type = 'character varying' then
    -- Drop PK first
    alter table public.users drop constraint if exists users_pkey;
    alter table public.users
      alter column id type uuid using id::uuid;
    alter table public.users
      add primary key (id);
  end if;
end $$;

alter table public.users add column if not exists name text;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.users
    add column role public.user_role not null default 'viewer';
exception
  when duplicate_column then null;
end $$;

-- knowledge_base.uploaded_by must be uuid if present
do $$
declare
  col_type text;
begin
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'knowledge_base'
    and column_name = 'uploaded_by';

  if col_type = 'text' or col_type = 'character varying' then
    alter table public.knowledge_base
      alter column uploaded_by type uuid using nullif(uploaded_by, '')::uuid;
  end if;
exception
  when undefined_table then null;
end $$;

-- Re-attach knowledge_base → users FK if table exists
do $$ begin
  alter table public.knowledge_base
    add constraint knowledge_base_uploaded_by_fkey
    foreign key (uploaded_by) references public.users (id) on delete set null;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_column then null;
end $$;

-- Chat / collections (from 002) — safe if already exist
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null default 'New chat',
  document_id uuid references public.knowledge_base (id) on delete set null,
  collection_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_id_idx
  on public.conversations (user_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  confidence double precision,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx
  on public.messages (conversation_id, created_at asc);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists collections_name_unique_idx
  on public.collections (lower(name));

create table if not exists public.collection_documents (
  collection_id uuid not null references public.collections (id) on delete cascade,
  document_id uuid not null references public.knowledge_base (id) on delete cascade,
  primary key (collection_id, document_id)
);

create index if not exists collection_documents_document_id_idx
  on public.collection_documents (document_id);

do $$ begin
  alter table public.conversations
    add constraint conversations_collection_id_fkey
    foreign key (collection_id) references public.collections (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

alter table public.search_logs
  add column if not exists source text;
alter table public.search_logs
  add column if not exists had_hits boolean;
alter table public.search_logs
  add column if not exists avg_similarity double precision;

-- updated_at helper (from 001) if missing
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.collections enable row level security;
alter table public.collection_documents enable row level security;

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
as $$
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
$$;

-- Permissions (required on newer Supabase projects)
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
