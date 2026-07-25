-- Fix: Google SSO fails with AccessDenied when password_hash is missing.
-- Run once in Supabase → SQL Editor (project: same as NEXT_PUBLIC_SUPABASE_URL).

do $$ begin
  create type public.user_role as enum ('viewer', 'admin');
exception
  when duplicate_object then null;
end $$;

alter table public.users
  add column if not exists name text;

alter table public.users
  add column if not exists email text;

alter table public.users
  add column if not exists password_hash text;

-- role may already exist as text; only add if missing
do $$ begin
  alter table public.users
    add column role public.user_role not null default 'viewer';
exception
  when duplicate_column then null;
end $$;

alter table public.users
  add column if not exists created_at timestamptz not null default now();

alter table public.users
  add column if not exists updated_at timestamptz not null default now();

-- Verify (should list password_hash)
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'users';
