-- Feature wave: conversations, collections, enriched search logs, collection-scoped RAG

-- Conversations
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

-- Messages
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

-- Collections
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

-- FK for conversations.collection_id (after collections exists)
do $$ begin
  alter table public.conversations
    add constraint conversations_collection_id_fkey
    foreign key (collection_id) references public.collections (id) on delete set null;
exception
  when duplicate_object then null;
end $$;

-- Enrich search_logs
alter table public.search_logs
  add column if not exists source text check (source in ('chat', 'search'));
alter table public.search_logs
  add column if not exists had_hits boolean;
alter table public.search_logs
  add column if not exists avg_similarity double precision;

-- updated_at triggers
drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.collections enable row level security;
alter table public.collection_documents enable row level security;

-- Collection-aware similarity search (keeps single-doc filter)
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
