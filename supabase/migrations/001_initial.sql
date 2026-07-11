-- AI Knowledge Assistant — initial schema
-- Run in Supabase SQL Editor (or via CLI)

create extension if not exists "pgcrypto";
create extension if not exists "vector";

do $$ begin
  create type public.user_role as enum ('viewer', 'admin');
exception
  when duplicate_object then null;
end $$;

-- Users (app profiles; Auth.js credentials + optional SSO email match)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);
create index if not exists users_role_idx on public.users (role);

-- Knowledge base documents
create table if not exists public.knowledge_base (
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

create index if not exists knowledge_base_status_idx on public.knowledge_base (status);
create index if not exists knowledge_base_uploaded_by_idx on public.knowledge_base (uploaded_by);

-- Chunks + embeddings (OpenAI text-embedding-3-small = 1536 dims)
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_base (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  page_number integer,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);

create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Search / chat audit log
create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  query_text text not null,
  documents_accessed uuid[] default '{}',
  timestamp timestamptz not null default now()
);

create index if not exists search_logs_user_id_idx on public.search_logs (user_id);
create index if not exists search_logs_timestamp_idx on public.search_logs (timestamp desc);

-- Similarity search RPC
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  filter_document_id uuid default null
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
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- updated_at trigger
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

drop trigger if exists knowledge_base_set_updated_at on public.knowledge_base;
create trigger knowledge_base_set_updated_at
  before update on public.knowledge_base
  for each row execute function public.set_updated_at();

-- RLS: deny direct anon/authenticated access; app uses service role server-side
alter table public.users enable row level security;
alter table public.knowledge_base enable row level security;
alter table public.document_chunks enable row level security;
alter table public.search_logs enable row level security;

-- No public policies — all access via Next.js server with service role key

-- Storage bucket (run once; ignore if exists)
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
