alter table public.ai_voice_clones
add column if not exists sample_transcript text not null default '';

alter table public.ai_voice_clones
add column if not exists sample_detected_language text not null default '';

