create table if not exists public.ai_video_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'AI Video Agent Project',
  script_mode text not null default 'manual',
  topic text not null default '',
  script text not null default '',
  avatar_id text not null default '',
  avatar_name text not null default '',
  avatar_image_url text not null default '',
  avatar_source text not null default '',
  voice_id text not null default '',
  voice_name text not null default '',
  voice_source text not null default 'default',
  provider_voice_id text not null default '',
  voice_audio_url text not null default '',
  duration_seconds integer not null default 30,
  aspect_ratio text not null default '16:9',
  caption_style text not null default 'clean_lower',
  b_roll_style text not null default 'stock',
  scene_count integer not null default 4,
  credits_cost integer not null default 0,
  status text not null default 'queued',
  progress integer not null default 0,
  message text not null default '',
  error text not null default '',
  credits_refunded boolean not null default false,
  trigger_run_id text,
  render_trigger_run_id text,
  final_video_url text not null default '',
  final_video_key text not null default '',
  thumbnail_url text not null default '',
  thumbnail_key text not null default '',
  captions jsonb not null default '[]'::jsonb,
  composition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_projects_script_mode_check check (script_mode in ('manual', 'topic')),
  constraint ai_video_projects_duration_check check (duration_seconds in (30, 60, 90, 120)),
  constraint ai_video_projects_aspect_ratio_check check (aspect_ratio in ('16:9', '9:16')),
  constraint ai_video_projects_caption_style_check check (caption_style in ('clean_lower', 'cinematic_gold', 'neon_pop', 'editorial_stack', 'minimal_box', 'karaoke_wave')),
  constraint ai_video_projects_b_roll_style_check check (b_roll_style in ('ai_images', 'stock', 'ai_video', 'illustration_animation')),
  constraint ai_video_projects_status_check check (status in ('queued', 'running', 'generating', 'rendering', 'uploading', 'completed', 'failed')),
  constraint ai_video_projects_voice_source_check check (voice_source in ('custom', 'default')),
  constraint ai_video_projects_progress_check check (progress between 0 and 100),
  constraint ai_video_projects_scene_count_check check (scene_count > 0),
  constraint ai_video_projects_credits_cost_check check (credits_cost >= 0)
);

create table if not exists public.ai_video_scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scene_index integer not null,
  start_seconds numeric not null default 0,
  end_seconds numeric not null default 0,
  title text not null default '',
  summary text not null default '',
  narration text not null default '',
  caption_text text not null default '',
  b_roll_request text not null default '',
  prompt text not null default '',
  keyword text not null default '',
  avatar_clip_required boolean not null default false,
  remotion_scene jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_scenes_scene_index_check check (scene_index >= 0),
  constraint ai_video_scenes_timing_check check (end_seconds >= start_seconds)
);

create table if not exists public.ai_video_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_projects(id) on delete cascade,
  scene_id uuid references public.ai_video_scenes(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null,
  provider text not null default '',
  url text not null default '',
  key text not null default '',
  content_type text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_assets_type_check check (asset_type in ('avatar_clip', 'b_roll_image', 'b_roll_video', 'voiceover', 'captions_json', 'composition_json', 'preview', 'thumbnail', 'final_render'))
);

create index if not exists ai_video_projects_user_created_idx
on public.ai_video_projects (user_id, created_at desc);

create index if not exists ai_video_projects_user_status_idx
on public.ai_video_projects (user_id, status, created_at desc);

create index if not exists ai_video_scenes_project_idx
on public.ai_video_scenes (project_id, scene_index);

create index if not exists ai_video_scenes_user_created_idx
on public.ai_video_scenes (user_id, created_at desc);

create index if not exists ai_video_assets_project_idx
on public.ai_video_assets (project_id, asset_type);

create index if not exists ai_video_assets_user_created_idx
on public.ai_video_assets (user_id, created_at desc);

drop trigger if exists set_ai_video_projects_updated_at on public.ai_video_projects;
create trigger set_ai_video_projects_updated_at
before update on public.ai_video_projects
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_video_scenes_updated_at on public.ai_video_scenes;
create trigger set_ai_video_scenes_updated_at
before update on public.ai_video_scenes
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_video_assets_updated_at on public.ai_video_assets;
create trigger set_ai_video_assets_updated_at
before update on public.ai_video_assets
for each row
execute function public.set_updated_at();

alter table public.ai_video_projects enable row level security;
alter table public.ai_video_scenes enable row level security;
alter table public.ai_video_assets enable row level security;

drop policy if exists "users can read own ai video projects" on public.ai_video_projects;
drop policy if exists "users can insert own ai video projects" on public.ai_video_projects;
drop policy if exists "users can update own ai video projects" on public.ai_video_projects;
drop policy if exists "users can delete own ai video projects" on public.ai_video_projects;

create policy "users can read own ai video projects"
on public.ai_video_projects for select
using (user_id = auth.uid());

create policy "users can insert own ai video projects"
on public.ai_video_projects for insert
with check (user_id = auth.uid());

create policy "users can update own ai video projects"
on public.ai_video_projects for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own ai video projects"
on public.ai_video_projects for delete
using (user_id = auth.uid());

drop policy if exists "users can read own ai video scenes" on public.ai_video_scenes;
drop policy if exists "users can insert own ai video scenes" on public.ai_video_scenes;
drop policy if exists "users can update own ai video scenes" on public.ai_video_scenes;
drop policy if exists "users can delete own ai video scenes" on public.ai_video_scenes;

create policy "users can read own ai video scenes"
on public.ai_video_scenes for select
using (user_id = auth.uid());

create policy "users can insert own ai video scenes"
on public.ai_video_scenes for insert
with check (user_id = auth.uid());

create policy "users can update own ai video scenes"
on public.ai_video_scenes for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own ai video scenes"
on public.ai_video_scenes for delete
using (user_id = auth.uid());

drop policy if exists "users can read own ai video assets" on public.ai_video_assets;
drop policy if exists "users can insert own ai video assets" on public.ai_video_assets;
drop policy if exists "users can update own ai video assets" on public.ai_video_assets;
drop policy if exists "users can delete own ai video assets" on public.ai_video_assets;

create policy "users can read own ai video assets"
on public.ai_video_assets for select
using (user_id = auth.uid());

create policy "users can insert own ai video assets"
on public.ai_video_assets for insert
with check (user_id = auth.uid());

create policy "users can update own ai video assets"
on public.ai_video_assets for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own ai video assets"
on public.ai_video_assets for delete
using (user_id = auth.uid());
