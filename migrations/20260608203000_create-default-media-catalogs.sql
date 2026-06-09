create table if not exists public.default_avatars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  style text not null,
  image_url text not null,
  image_key text not null default '',
  desktop_image_url text not null default '',
  desktop_image_key text not null default '',
  mobile_image_url text not null default '',
  mobile_image_key text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint default_avatars_style_check check (style in ('Podcast', 'Casual', '3D Cartoon', 'Stylized'))
);

create table if not exists public.user_avatar_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_source text not null default 'custom',
  selected_custom_avatar_id uuid references public.ai_avatars(id) on delete set null,
  selected_default_avatar_id uuid references public.default_avatars(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_avatar_preferences_source_check check (selected_source in ('custom', 'default')),
  constraint user_avatar_preferences_selection_check check (
    (selected_source = 'custom' and selected_default_avatar_id is null)
    or
    (selected_source = 'default' and selected_custom_avatar_id is null)
  )
);

create table if not exists public.default_voices (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  provider text not null default 'deepgram',
  provider_voice_id text not null,
  language text not null default 'en',
  gender text not null,
  preview_text text not null default '',
  avatar_image_url text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint default_voices_provider_check check (provider in ('deepgram')),
  constraint default_voices_gender_check check (gender in ('female', 'male'))
);

create table if not exists public.user_voice_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_source text not null default 'custom',
  selected_custom_voice_id uuid references public.ai_voice_clones(id) on delete set null,
  selected_default_voice_id uuid references public.default_voices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_voice_preferences_source_check check (selected_source in ('custom', 'default')),
  constraint user_voice_preferences_selection_check check (
    (selected_source = 'custom' and selected_default_voice_id is null)
    or
    (selected_source = 'default' and selected_custom_voice_id is null)
  )
);

insert into public.default_avatars (
  slug,
  name,
  style,
  image_url,
  image_key,
  desktop_image_url,
  desktop_image_key,
  mobile_image_url,
  mobile_image_key,
  active,
  sort_order,
  version
) values
  ('podcast-host', 'xuefeng', 'Podcast', '/avatars/xuefeng.webp', 'default:podcast-host', '/avatars/xuefeng.webp', 'default:podcast-host', '/avatars/xuefeng.webp', 'default:podcast-host', true, 10, 1),
  ('casual-founder', 'Taylor', 'Casual', '/avatars/taylor.jpg', 'default:casual-founder', '/avatars/taylor.jpg', 'default:casual-founder', '/avatars/taylor.jpg', 'default:casual-founder', true, 20, 1),
  ('cartoon-guide', 'Emma', '3D Cartoon', '/avatars/emma.webp', 'default:cartoon-guide', '/avatars/emma.webp', 'default:cartoon-guide', '/avatars/emma.webp', 'default:cartoon-guide', true, 30, 1),
  ('stylized-muse', 'Jack', 'Stylized', '/avatars/jack.jpg', 'default:stylized-muse', '/avatars/jack.jpg', 'default:stylized-muse', '/avatars/jack.jpg', 'default:stylized-muse', true, 40, 1)
on conflict (slug) do update set
  name = excluded.name,
  style = excluded.style,
  image_url = excluded.image_url,
  image_key = excluded.image_key,
  desktop_image_url = excluded.desktop_image_url,
  desktop_image_key = excluded.desktop_image_key,
  mobile_image_url = excluded.mobile_image_url,
  mobile_image_key = excluded.mobile_image_key,
  active = excluded.active,
  sort_order = excluded.sort_order,
  version = excluded.version;

insert into public.default_voices (
  slug,
  name,
  provider,
  provider_voice_id,
  language,
  gender,
  preview_text,
  avatar_image_url,
  active,
  sort_order,
  version
) values
  ('deepgram-thalia', 'Thalia', 'deepgram', 'aura-2-thalia-en', 'en', 'female', 'Hi, I am Thalia. A warm voice for clear studio narration.', '/avatar/thalia.png', true, 10, 1),
  ('deepgram-izanami', 'Izanami', 'deepgram', 'aura-2-izanami-ja', 'ja', 'female', 'Hello, I am Izanami. A poised voice for polished Japanese narration.', '/avatar/izanami.png', true, 20, 1),
  ('deepgram-helena', 'Helena', 'deepgram', 'aura-2-helena-en', 'en', 'female', 'Hi, I am Helena. A calm voice for thoughtful explanations.', '/avatar/helena.jpg', true, 30, 1),
  ('deepgram-apollo', 'Apollo', 'deepgram', 'aura-2-apollo-en', 'en', 'male', 'Hi, I am Apollo. A confident voice for direct presentations.', '/avatar/apollo.jpg', true, 40, 1),
  ('deepgram-arcas', 'Arcas', 'deepgram', 'aura-2-arcas-en', 'en', 'male', 'Hi, I am Arcas. A crisp voice for concise generated audio.', '/avatar/arcas.jpg', true, 50, 1),
  ('deepgram-fujin', 'Fujin', 'deepgram', 'aura-2-fujin-ja', 'ja', 'male', 'Hello, I am Fujin. A grounded voice for natural Japanese narration.', '/avatar/fujin.jpg', true, 60, 1)
on conflict (slug) do update set
  name = excluded.name,
  provider = excluded.provider,
  provider_voice_id = excluded.provider_voice_id,
  language = excluded.language,
  gender = excluded.gender,
  preview_text = excluded.preview_text,
  avatar_image_url = excluded.avatar_image_url,
  active = excluded.active,
  sort_order = excluded.sort_order,
  version = excluded.version;

insert into public.user_avatar_preferences (
  user_id,
  selected_source,
  selected_custom_avatar_id,
  selected_default_avatar_id
)
select
  avatar.user_id,
  'default',
  null,
  catalog.id
from public.ai_avatars avatar
join public.default_avatars catalog
  on catalog.slug = replace(avatar.image_key, 'default:', '')
where avatar.source = 'default'
  and avatar.is_selected = true
on conflict (user_id) do update set
  selected_source = excluded.selected_source,
  selected_custom_avatar_id = excluded.selected_custom_avatar_id,
  selected_default_avatar_id = excluded.selected_default_avatar_id;

insert into public.user_avatar_preferences (
  user_id,
  selected_source,
  selected_custom_avatar_id,
  selected_default_avatar_id
)
select
  avatar.user_id,
  'custom',
  avatar.id,
  null
from public.ai_avatars avatar
where avatar.source <> 'default'
  and avatar.is_selected = true
  and not exists (
    select 1
    from public.user_avatar_preferences preference
    where preference.user_id = avatar.user_id
  )
on conflict (user_id) do nothing;

insert into public.user_voice_preferences (
  user_id,
  selected_source,
  selected_custom_voice_id,
  selected_default_voice_id
)
select
  voice.user_id,
  'custom',
  voice.id,
  null
from public.ai_voice_clones voice
where voice.is_selected = true
on conflict (user_id) do update set
  selected_source = excluded.selected_source,
  selected_custom_voice_id = excluded.selected_custom_voice_id,
  selected_default_voice_id = excluded.selected_default_voice_id;

delete from public.ai_avatars
where source = 'default';

drop policy if exists "users can insert own avatars" on public.ai_avatars;
drop policy if exists "users can update own avatars" on public.ai_avatars;

create policy "users can insert own avatars"
on public.ai_avatars
for insert
with check (user_id = auth.uid() and source <> 'default');

create policy "users can update own avatars"
on public.ai_avatars
for update
using (user_id = auth.uid() and source <> 'default')
with check (user_id = auth.uid() and source <> 'default');

alter table public.ai_avatars drop constraint if exists ai_avatars_source_check;
alter table public.ai_avatars
add constraint ai_avatars_source_check check (source in ('upload', 'ai'));

create index if not exists default_avatars_active_sort_idx
on public.default_avatars (active, sort_order, name);

create index if not exists default_voices_active_sort_idx
on public.default_voices (active, sort_order, name);

drop trigger if exists set_default_avatars_updated_at on public.default_avatars;
create trigger set_default_avatars_updated_at
before update on public.default_avatars
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_avatar_preferences_updated_at on public.user_avatar_preferences;
create trigger set_user_avatar_preferences_updated_at
before update on public.user_avatar_preferences
for each row
execute function public.set_updated_at();

drop trigger if exists set_default_voices_updated_at on public.default_voices;
create trigger set_default_voices_updated_at
before update on public.default_voices
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_voice_preferences_updated_at on public.user_voice_preferences;
create trigger set_user_voice_preferences_updated_at
before update on public.user_voice_preferences
for each row
execute function public.set_updated_at();

alter table public.default_avatars enable row level security;
alter table public.user_avatar_preferences enable row level security;
alter table public.default_voices enable row level security;
alter table public.user_voice_preferences enable row level security;

drop policy if exists "authenticated users can read active default avatars" on public.default_avatars;
create policy "authenticated users can read active default avatars"
on public.default_avatars
for select
to authenticated
using (active = true);

drop policy if exists "users can read own avatar preference" on public.user_avatar_preferences;
drop policy if exists "users can insert own avatar preference" on public.user_avatar_preferences;
drop policy if exists "users can update own avatar preference" on public.user_avatar_preferences;
drop policy if exists "users can delete own avatar preference" on public.user_avatar_preferences;

create policy "users can read own avatar preference"
on public.user_avatar_preferences for select
using (user_id = auth.uid());

create policy "users can insert own avatar preference"
on public.user_avatar_preferences for insert
with check (user_id = auth.uid());

create policy "users can update own avatar preference"
on public.user_avatar_preferences for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own avatar preference"
on public.user_avatar_preferences for delete
using (user_id = auth.uid());

drop policy if exists "authenticated users can read active default voices" on public.default_voices;
create policy "authenticated users can read active default voices"
on public.default_voices
for select
to authenticated
using (active = true);

drop policy if exists "users can read own voice preference" on public.user_voice_preferences;
drop policy if exists "users can insert own voice preference" on public.user_voice_preferences;
drop policy if exists "users can update own voice preference" on public.user_voice_preferences;
drop policy if exists "users can delete own voice preference" on public.user_voice_preferences;

create policy "users can read own voice preference"
on public.user_voice_preferences for select
using (user_id = auth.uid());

create policy "users can insert own voice preference"
on public.user_voice_preferences for insert
with check (user_id = auth.uid());

create policy "users can update own voice preference"
on public.user_voice_preferences for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own voice preference"
on public.user_voice_preferences for delete
using (user_id = auth.uid());

grant select on public.default_avatars to authenticated;
grant select, insert, update, delete on public.user_avatar_preferences to authenticated;
grant select on public.default_voices to authenticated;
grant select, insert, update, delete on public.user_voice_preferences to authenticated;
