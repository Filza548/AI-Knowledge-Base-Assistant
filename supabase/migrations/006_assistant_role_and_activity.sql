-- ============================================================================
-- Roles: viewer → assistant
-- Activity log: who (admin/assistant) did what
-- ============================================================================

-- Rename enum value (Postgres 10+)
do $do$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_role'
      and e.enumlabel = 'viewer'
  ) then
    alter type public.user_role rename value 'viewer' to 'assistant';
  end if;
end
$do$;

alter table public.users
  alter column role set default 'assistant'::public.user_role;

-- Google-only accounts (no password) should be assistants
update public.users
set role = 'assistant'
where password_hash is null
  and role = 'admin';

-- Enrich search_logs so Table Editor shows role clearly
alter table public.search_logs
  add column if not exists user_email text,
  add column if not exists user_role text;

-- Full activity trail (upload, summarize, chat, search, login, …)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  user_email text,
  user_role text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);

create index if not exists activity_logs_user_id_idx
  on public.activity_logs (user_id);

create index if not exists activity_logs_user_role_idx
  on public.activity_logs (user_role);

alter table public.activity_logs enable row level security;

grant all on table public.activity_logs to postgres, anon, authenticated, service_role;
