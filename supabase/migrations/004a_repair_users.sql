-- ============================================================================
-- PART A — users.id text→uuid + password_hash
-- Paste ONLY this block. Run. Then go to PART B.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

do $do$
begin
  create type public.user_role as enum ('viewer', 'admin');
exception
  when duplicate_object then null;
end
$do$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null,
  password_hash text,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Drop FKs pointing at users.id (block type change)
do $do$
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
end
$do$;

-- text/varchar id → uuid
do $do$
declare
  id_type text;
begin
  select data_type into id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'users'
    and column_name = 'id';

  if id_type in ('text', 'character varying') then
    alter table public.users drop constraint if exists users_pkey;
    alter table public.users alter column id type uuid using id::uuid;
    alter table public.users add primary key (id);
  end if;
end
$do$;

alter table public.users add column if not exists name text;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users add column if not exists updated_at timestamptz not null default now();

do $do$
begin
  alter table public.users
    add column role public.user_role not null default 'viewer';
exception
  when duplicate_column then null;
end
$do$;
