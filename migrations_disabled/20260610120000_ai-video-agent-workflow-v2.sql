alter table public.ai_video_projects
  add column if not exists workflow_version integer not null default 2,
  add column if not exists timeline jsonb not null default '{}'::jsonb,
  add column if not exists generation_mode text not null default 'scene_segments',
  add column if not exists lip_sync_mode text not null default 'compatible',
  add column if not exists caption_effect text not null default 'soft_fade';

alter table public.ai_video_projects
  drop constraint if exists ai_video_projects_generation_mode_check,
  add constraint ai_video_projects_generation_mode_check
    check (generation_mode in ('scene_segments'));

alter table public.ai_video_projects
  drop constraint if exists ai_video_projects_lip_sync_mode_check,
  add constraint ai_video_projects_lip_sync_mode_check
    check (lip_sync_mode in ('compatible', 'audio_driven', 'fallback_text_only'));

alter table public.ai_video_projects
  drop constraint if exists ai_video_projects_caption_effect_check,
  add constraint ai_video_projects_caption_effect_check
    check (caption_effect in ('soft_fade', 'pop_bounce', 'neon_underline', 'cat_ears', 'cinematic_gold', 'karaoke_wave'));

create table if not exists public.ai_video_dialogues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_video_projects(id) on delete cascade,
  scene_id uuid not null references public.ai_video_scenes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dialogue_index integer not null,
  start_seconds numeric not null default 0,
  end_seconds numeric not null default 0,
  text text not null default '',
  emotion text not null default '',
  audio_asset_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_video_dialogues_dialogue_index_check check (dialogue_index >= 0),
  constraint ai_video_dialogues_timing_check check (end_seconds >= start_seconds)
);

create index if not exists ai_video_dialogues_project_idx
on public.ai_video_dialogues (project_id, start_seconds);

create index if not exists ai_video_dialogues_scene_idx
on public.ai_video_dialogues (scene_id, dialogue_index);

drop trigger if exists set_ai_video_dialogues_updated_at on public.ai_video_dialogues;
create trigger set_ai_video_dialogues_updated_at
before update on public.ai_video_dialogues
for each row
execute function public.set_updated_at();

alter table public.ai_video_dialogues enable row level security;

drop policy if exists "users can read own ai video dialogues" on public.ai_video_dialogues;
drop policy if exists "users can insert own ai video dialogues" on public.ai_video_dialogues;
drop policy if exists "users can update own ai video dialogues" on public.ai_video_dialogues;
drop policy if exists "users can delete own ai video dialogues" on public.ai_video_dialogues;

create policy "users can read own ai video dialogues"
on public.ai_video_dialogues for select
using (user_id = auth.uid());

create policy "users can insert own ai video dialogues"
on public.ai_video_dialogues for insert
with check (user_id = auth.uid());

create policy "users can update own ai video dialogues"
on public.ai_video_dialogues for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own ai video dialogues"
on public.ai_video_dialogues for delete
using (user_id = auth.uid());

alter table public.ai_video_assets
  drop constraint if exists ai_video_assets_type_check,
  add constraint ai_video_assets_type_check check (asset_type in (
    'avatar_clip',
    'b_roll_image',
    'b_roll_video',
    'voiceover',
    'captions_json',
    'composition_json',
    'preview',
    'thumbnail',
    'final_render',
    'scene_image',
    'scene_video',
    'dialogue_audio',
    'avatar_scene_video'
  ));
