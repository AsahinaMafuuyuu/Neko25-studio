alter table public.ai_video_avatar_jobs
add column if not exists provider_video_id text not null default '';

create index if not exists ai_video_avatar_jobs_provider_video_idx
on public.ai_video_avatar_jobs (provider_video_id)
where provider_video_id <> '';
