create table if not exists public.users (
  id uuid primary key,
  name text,
  avatar_url text,
  email text,
  providers text[] not null default '{}',
  email_verified boolean not null default false,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists name text,
  add column if not exists avatar_url text,
  add column if not exists email text,
  add column if not exists providers text[] not null default '{}',
  add column if not exists email_verified boolean not null default false,
  add column if not exists last_sign_in_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;

create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

alter table public.users enable row level security;

drop policy if exists "users can read own profile" on public.users;
drop policy if exists "users can insert own profile" on public.users;
drop policy if exists "users can update own profile" on public.users;

create policy "users can read own profile"
on public.users
for select
using (id = auth.uid());

create policy "users can insert own profile"
on public.users
for insert
with check (id = auth.uid());

create policy "users can update own profile"
on public.users
for update
using (id = auth.uid())
with check (id = auth.uid());
