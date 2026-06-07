alter table public.ai_avatars
add column if not exists desktop_image_url text not null default '',
add column if not exists desktop_image_key text not null default '',
add column if not exists mobile_image_url text not null default '',
add column if not exists mobile_image_key text not null default '';

update public.ai_avatars
set
  desktop_image_url = coalesce(nullif(desktop_image_url, ''), image_url),
  desktop_image_key = coalesce(nullif(desktop_image_key, ''), image_key),
  mobile_image_url = coalesce(nullif(mobile_image_url, ''), image_url),
  mobile_image_key = coalesce(nullif(mobile_image_key, ''), image_key);
