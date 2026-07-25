-- Access control: invited / pending approval / active / rejected
do $$ begin
  create type public.user_status as enum ('invited', 'pending', 'active', 'rejected');
exception
  when duplicate_object then null;
end $$;

alter table public.users
  add column if not exists status public.user_status;

-- Existing accounts keep access
update public.users
set status = 'active'
where status is null;

alter table public.users
  alter column status set default 'pending'::public.user_status;

alter table public.users
  alter column status set not null;

alter table public.users
  add column if not exists invite_token text;

alter table public.users
  add column if not exists invite_expires_at timestamptz;

alter table public.users
  add column if not exists invited_by uuid references public.users (id) on delete set null;

alter table public.users
  add column if not exists requested_at timestamptz;

alter table public.users
  add column if not exists approved_at timestamptz;

alter table public.users
  add column if not exists approved_by uuid references public.users (id) on delete set null;

create unique index if not exists users_invite_token_uidx
  on public.users (invite_token)
  where invite_token is not null;

create index if not exists users_status_idx on public.users (status);
