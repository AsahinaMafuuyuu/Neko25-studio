alter table public.ai_video_avatar_jobs
  alter column provider_task_id set default '',
  alter column provider_status set default '',
  alter column message set default '',
  alter column error set default '';

alter table public.ai_video_avatar_jobs
  alter column provider_video_id set default '';
