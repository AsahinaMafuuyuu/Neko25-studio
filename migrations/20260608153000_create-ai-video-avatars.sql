create table if not exists public.ai_video_avatar_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Avatar Video',
  script text not null default '',
  avatar_id uuid references public.ai_avatars(id) on delete set null,
  avatar_name text not null default '',
  avatar_image_url text not null default '',
  avatar_image_key text not null default '',
  avatar_source text not null default 'upload',
  voice_clone_id uuid references public.ai_voice_clones(id) on delete set null,
  voice_name text not null default '',
  voice_source text not null default 'default',
  provider_voice_id text not null default '',
  voice_audio_url text not null default '',
  aspect_ratio text not null default '16:9',
  duration_seconds integer not null default 10,
  credits_cost integer not null default 0,
  status text not null default 'queued',
  progress integer not null default 0,
  message text not null default '',
  error text not null default '',
  video_url text not null default '',
  video_key text not null default '',
  thumbnail_url text not null default '',
  thumbnail_key text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_avatar_videos_voice_source_check check (voice_source in ('custom', 'default')),
  constraint ai_video_avatar_videos_aspect_ratio_check check (aspect_ratio in ('16:9', '9:16')),
  constraint ai_video_avatar_videos_duration_check check (duration_seconds in (5, 10, 20, 30, 60)),
  constraint ai_video_avatar_videos_status_check check (status in ('queued', 'running', 'generating', 'uploading', 'completed', 'failed')),
  constraint ai_video_avatar_videos_progress_check check (progress between 0 and 100),
  constraint ai_video_avatar_videos_credits_cost_check check (credits_cost >= 0),
  constraint ai_video_avatar_videos_script_length_check check (char_length(script) <= 2000)
);

create table if not exists public.ai_video_avatar_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.ai_video_avatar_videos(id) on delete cascade,
  trigger_run_id text,
  provider_task_id text not null default '',
  provider_status text not null default '',
  status text not null default 'queued',
  progress integer not null default 0,
  message text not null default '',
  error text not null default '',
  credits_refunded boolean not null default false,
  callback_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_avatar_jobs_status_check check (status in ('queued', 'running', 'generating', 'uploading', 'completed', 'failed')),
  constraint ai_video_avatar_jobs_progress_check check (progress between 0 and 100)
);

create index if not exists ai_video_avatar_videos_user_created_idx
on public.ai_video_avatar_videos (user_id, created_at desc);

create index if not exists ai_video_avatar_jobs_user_created_idx
on public.ai_video_avatar_jobs (user_id, created_at desc);

create index if not exists ai_video_avatar_jobs_video_idx
on public.ai_video_avatar_jobs (video_id);

create index if not exists ai_video_avatar_jobs_provider_task_idx
on public.ai_video_avatar_jobs (provider_task_id)
where provider_task_id <> '';

drop trigger if exists set_ai_video_avatar_videos_updated_at on public.ai_video_avatar_videos;
create trigger set_ai_video_avatar_videos_updated_at
before update on public.ai_video_avatar_videos
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_video_avatar_jobs_updated_at on public.ai_video_avatar_jobs;
create trigger set_ai_video_avatar_jobs_updated_at
before update on public.ai_video_avatar_jobs
for each row
execute function public.set_updated_at();

alter table public.ai_video_avatar_videos enable row level security;
alter table public.ai_video_avatar_jobs enable row level security;

drop policy if exists "users can read own video avatar videos" on public.ai_video_avatar_videos;
drop policy if exists "users can insert own video avatar videos" on public.ai_video_avatar_videos;
drop policy if exists "users can update own video avatar videos" on public.ai_video_avatar_videos;
drop policy if exists "users can delete own video avatar videos" on public.ai_video_avatar_videos;

create policy "users can read own video avatar videos"
on public.ai_video_avatar_videos for select
using (user_id = auth.uid());

create policy "users can insert own video avatar videos"
on public.ai_video_avatar_videos for insert
with check (user_id = auth.uid());

create policy "users can update own video avatar videos"
on public.ai_video_avatar_videos for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own video avatar videos"
on public.ai_video_avatar_videos for delete
using (user_id = auth.uid());

drop policy if exists "users can read own video avatar jobs" on public.ai_video_avatar_jobs;
drop policy if exists "users can insert own video avatar jobs" on public.ai_video_avatar_jobs;
drop policy if exists "users can update own video avatar jobs" on public.ai_video_avatar_jobs;

create policy "users can read own video avatar jobs"
on public.ai_video_avatar_jobs for select
using (user_id = auth.uid());

create policy "users can insert own video avatar jobs"
on public.ai_video_avatar_jobs for insert
with check (user_id = auth.uid());

create policy "users can update own video avatar jobs"
on public.ai_video_avatar_jobs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
