create table if not exists public.ai_avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Avatar',
  style text not null default 'Casual',
  image_url text not null,
  image_key text not null default '',
  desktop_image_url text not null default '',
  desktop_image_key text not null default '',
  mobile_image_url text not null default '',
  mobile_image_key text not null default '',
  source text not null default 'upload',
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_avatars_style_check check (style in ('Podcast', 'Casual', '3D Cartoon', 'Stylized')),
  constraint ai_avatars_source_check check (source in ('default', 'upload', 'ai'))
);

create table if not exists public.ai_avatar_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  avatar_id uuid references public.ai_avatars(id) on delete set null,
  trigger_run_id text,
  style text not null default 'Casual',
  prompt text not null default '',
  source_image_url text not null default '',
  source_image_key text not null default '',
  status text not null default 'queued',
  progress integer not null default 0,
  message text not null default '',
  error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_avatar_jobs_style_check check (style in ('Podcast', 'Casual', '3D Cartoon', 'Stylized')),
  constraint ai_avatar_jobs_status_check check (status in ('queued', 'running', 'generating', 'uploading', 'completed', 'failed')),
  constraint ai_avatar_jobs_progress_check check (progress between 0 and 100)
);

create index if not exists ai_avatars_user_created_idx
on public.ai_avatars (user_id, created_at desc);

create unique index if not exists ai_avatars_one_selected_per_user_idx
on public.ai_avatars (user_id)
where is_selected;

create index if not exists ai_avatar_jobs_user_created_idx
on public.ai_avatar_jobs (user_id, created_at desc);

drop trigger if exists set_ai_avatars_updated_at on public.ai_avatars;
create trigger set_ai_avatars_updated_at
before update on public.ai_avatars
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_avatar_jobs_updated_at on public.ai_avatar_jobs;
create trigger set_ai_avatar_jobs_updated_at
before update on public.ai_avatar_jobs
for each row
execute function public.set_updated_at();

alter table public.ai_avatars enable row level security;
alter table public.ai_avatar_jobs enable row level security;

drop policy if exists "users can read own avatars" on public.ai_avatars;
drop policy if exists "users can insert own avatars" on public.ai_avatars;
drop policy if exists "users can update own avatars" on public.ai_avatars;
drop policy if exists "users can delete own avatars" on public.ai_avatars;

create policy "users can read own avatars"
on public.ai_avatars
for select
using (user_id = auth.uid());

create policy "users can insert own avatars"
on public.ai_avatars
for insert
with check (user_id = auth.uid());

create policy "users can update own avatars"
on public.ai_avatars
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own avatars"
on public.ai_avatars
for delete
using (user_id = auth.uid());

drop policy if exists "users can read own avatar jobs" on public.ai_avatar_jobs;
drop policy if exists "users can insert own avatar jobs" on public.ai_avatar_jobs;
drop policy if exists "users can update own avatar jobs" on public.ai_avatar_jobs;

create policy "users can read own avatar jobs"
on public.ai_avatar_jobs
for select
using (user_id = auth.uid());

create policy "users can insert own avatar jobs"
on public.ai_avatar_jobs
for insert
with check (user_id = auth.uid());

create policy "users can update own avatar jobs"
on public.ai_avatar_jobs
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
