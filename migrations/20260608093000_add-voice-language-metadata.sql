alter table public.ai_voice_clones
add column if not exists language text not null default 'en-us';

alter table public.ai_voice_clone_jobs
add column if not exists language text not null default 'en-us';

alter table public.ai_tts_jobs
add column if not exists language text not null default 'en-us';

alter table public.ai_tts_outputs
add column if not exists language text not null default 'en-us';

