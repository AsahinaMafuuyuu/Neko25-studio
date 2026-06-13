-- AI Video Agent workflow v2 main tables.
--
-- This migration intentionally does not ALTER the legacy ai_video_* tables.
-- Some existing legacy tables are owned by the platform postgres role, which
-- prevents project_admin migrations from evolving them. These v2 tables are the
-- new source of truth for AI Video Agent projects going forward.

create table if not exists public.ai_video_v2_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled AI Video',
  prompt text not null default '',
  script text not null default '',
  timeline jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  aspect_ratio text not null default '9:16',
  workflow_version integer not null default 2,
  generation_mode text not null default 'scene_segments',
  lip_sync_mode text not null default 'compatible',
  caption_effect text not null default 'soft_fade',
  avatar_asset_id uuid,
  voice_asset_id uuid,
  trigger_job_id text,
  final_video_url text,
  final_video_key text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_v2_projects_aspect_ratio_check check (aspect_ratio in ('16:9', '9:16')),
  constraint ai_video_v2_projects_workflow_version_check check (workflow_version = 2),
  constraint ai_video_v2_projects_status_check check (
    status in ('draft', 'queued', 'generating', 'rendering', 'completed', 'failed', 'cancelled')
  )
);

create table if not exists public.ai_video_v2_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_v2_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_index integer not null default 0,
  start_seconds numeric not null default 0,
  end_seconds numeric not null default 0,
  title text not null default '',
  summary text not null default '',
  visual_source text not null default 'auto',
  visual_prompt text not null default '',
  uploaded_asset_id uuid,
  resolved_asset_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_v2_scenes_visual_source_check check (visual_source in ('upload', 'pixabay', 'ai', 'auto')),
  constraint ai_video_v2_scenes_time_check check (end_seconds >= start_seconds),
  unique (project_id, scene_index)
);

create table if not exists public.ai_video_v2_dialogues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_v2_projects(id) on delete cascade,
  scene_id uuid references public.ai_video_v2_scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dialogue_index integer not null default 0,
  start_seconds numeric not null default 0,
  end_seconds numeric not null default 0,
  text text not null default '',
  emotion text,
  audio_asset_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_v2_dialogues_time_check check (end_seconds >= start_seconds),
  unique (project_id, scene_id, dialogue_index)
);

create table if not exists public.ai_video_v2_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_v2_projects(id) on delete cascade,
  scene_id uuid references public.ai_video_v2_scenes(id) on delete set null,
  dialogue_id uuid references public.ai_video_v2_dialogues(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null,
  provider text not null default 'unknown',
  storage_key text,
  public_url text,
  mime_type text,
  duration_seconds numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_v2_assets_type_check check (
    asset_type in (
      'avatar',
      'voice',
      'voiceover',
      'captions_json',
      'composition_json',
      'scene_image',
      'scene_video',
      'dialogue_audio',
      'avatar_scene_video',
      'final_render'
    )
  )
);

create table if not exists public.ai_video_v2_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_v2_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_job_id text,
  status text not null default 'queued',
  progress integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_v2_jobs_status_check check (
    status in ('queued', 'generating', 'rendering', 'completed', 'failed', 'cancelled')
  ),
  constraint ai_video_v2_jobs_progress_check check (progress between 0 and 100)
);

create index if not exists ai_video_v2_projects_user_created_idx
  on public.ai_video_v2_projects (user_id, created_at desc);

create index if not exists ai_video_v2_projects_trigger_job_idx
  on public.ai_video_v2_projects (trigger_job_id);

create index if not exists ai_video_v2_scenes_project_index_idx
  on public.ai_video_v2_scenes (project_id, scene_index);

create index if not exists ai_video_v2_dialogues_project_index_idx
  on public.ai_video_v2_dialogues (project_id, start_seconds, dialogue_index);

create index if not exists ai_video_v2_dialogues_scene_index_idx
  on public.ai_video_v2_dialogues (scene_id, dialogue_index);

create index if not exists ai_video_v2_assets_project_type_idx
  on public.ai_video_v2_assets (project_id, asset_type);

create index if not exists ai_video_v2_jobs_project_idx
  on public.ai_video_v2_jobs (project_id, created_at desc);

create index if not exists ai_video_v2_jobs_trigger_job_idx
  on public.ai_video_v2_jobs (trigger_job_id);

alter table public.ai_video_v2_projects enable row level security;
alter table public.ai_video_v2_scenes enable row level security;
alter table public.ai_video_v2_dialogues enable row level security;
alter table public.ai_video_v2_assets enable row level security;
alter table public.ai_video_v2_jobs enable row level security;

create policy "ai_video_v2_projects_owner_all"
  on public.ai_video_v2_projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_video_v2_scenes_owner_all"
  on public.ai_video_v2_scenes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_video_v2_dialogues_owner_all"
  on public.ai_video_v2_dialogues
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_video_v2_assets_owner_all"
  on public.ai_video_v2_assets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "ai_video_v2_jobs_owner_all"
  on public.ai_video_v2_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to project_admin;

grant select, insert, update, delete on public.ai_video_v2_projects to project_admin;
grant select, insert, update, delete on public.ai_video_v2_scenes to project_admin;
grant select, insert, update, delete on public.ai_video_v2_dialogues to project_admin;
grant select, insert, update, delete on public.ai_video_v2_assets to project_admin;
grant select, insert, update, delete on public.ai_video_v2_jobs to project_admin;

grant usage, select, update on all sequences in schema public to project_admin;

alter table public.ai_video_v2_projects owner to project_admin;
alter table public.ai_video_v2_scenes owner to project_admin;
alter table public.ai_video_v2_dialogues owner to project_admin;
alter table public.ai_video_v2_assets owner to project_admin;
alter table public.ai_video_v2_jobs owner to project_admin;
