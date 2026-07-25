-- ============================================================================
-- PART B — conversations / messages / collections
-- Run AFTER Part A succeeds. Paste ONLY this block.
-- ============================================================================

-- knowledge_base.uploaded_by → uuid if needed
do $do$
declare
  col_type text;
begin
  select data_type into col_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'knowledge_base'
    and column_name = 'uploaded_by';

  if col_type in ('text', 'character varying') then
    alter table public.knowledge_base
      alter column uploaded_by type uuid using nullif(uploaded_by, '')::uuid;
  end if;
exception
  when undefined_table then null;
end
$do$;

do $do$
begin
  alter table public.knowledge_base
    add constraint knowledge_base_uploaded_by_fkey
    foreign key (uploaded_by) references public.users (id) on delete set null;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_column then null;
end
$do$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null default 'New chat',
  document_id uuid,
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
  document_id uuid not null,
  primary key (collection_id, document_id)
);

create index if not exists collection_documents_document_id_idx
  on public.collection_documents (document_id);

-- Optional FKs to knowledge_base (ignore if KB table missing columns)
do $do$
begin
  alter table public.conversations
    add constraint conversations_document_id_fkey
    foreign key (document_id) references public.knowledge_base (id) on delete set null;
exception
  when duplicate_object then null;
  when undefined_table then null;
end
$do$;

do $do$
begin
  alter table public.collection_documents
    add constraint collection_documents_document_id_fkey
    foreign key (document_id) references public.knowledge_base (id) on delete cascade;
exception
  when duplicate_object then null;
  when undefined_table then null;
end
$do$;

do $do$
begin
  alter table public.conversations
    add constraint conversations_collection_id_fkey
    foreign key (collection_id) references public.collections (id) on delete set null;
exception
  when duplicate_object then null;
end
$do$;

alter table public.search_logs add column if not exists source text;
alter table public.search_logs add column if not exists had_hits boolean;
alter table public.search_logs add column if not exists avg_similarity double precision;
