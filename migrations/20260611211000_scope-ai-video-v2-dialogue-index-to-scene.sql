alter table public.ai_video_v2_dialogues
  drop constraint if exists ai_video_v2_dialogues_project_id_dialogue_index_key;

alter table public.ai_video_v2_dialogues
  drop constraint if exists ai_video_v2_dialogues_project_id_scene_id_dialogue_index_key;

alter table public.ai_video_v2_dialogues
  drop constraint if exists ai_video_v2_dialogues_project_scene_dialogue_index_key;

drop index if exists public.ai_video_v2_dialogues_project_index_idx;

alter table public.ai_video_v2_dialogues
  add constraint ai_video_v2_dialogues_project_scene_dialogue_index_key
  unique (project_id, scene_id, dialogue_index);

create index if not exists ai_video_v2_dialogues_project_index_idx
  on public.ai_video_v2_dialogues (project_id, start_seconds, dialogue_index);

create index if not exists ai_video_v2_dialogues_scene_index_idx
  on public.ai_video_v2_dialogues (scene_id, dialogue_index);
