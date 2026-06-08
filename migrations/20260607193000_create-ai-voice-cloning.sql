create table if not exists public.ai_voice_clones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source text not null default 'custom',
  sample_audio_url text not null,
  sample_audio_key text not null,
  preview_audio_url text not null default '',
  preview_audio_key text not null default '',
  avatar_image_url text not null default '',
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_voice_clones_source_check check (source in ('custom'))
);

create table if not exists public.ai_voice_clone_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_clone_id uuid references public.ai_voice_clones(id) on delete set null,
  trigger_run_id text,
  name text not null,
  sample_audio_url text not null,
  sample_audio_key text not null,
  status text not null default 'queued',
  progress integer not null default 0,
  message text not null default '',
  error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_voice_clone_jobs_status_check check (status in ('queued', 'running', 'generating', 'uploading', 'completed', 'failed')),
  constraint ai_voice_clone_jobs_progress_check check (progress between 0 and 100)
);

create table if not exists public.ai_tts_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  voice_clone_id uuid references public.ai_voice_clones(id) on delete set null,
  voice_name text not null,
  voice_source text not null,
  provider_voice_id text not null default '',
  text text not null,
  character_count integer not null default 0,
  credits_cost integer not null default 0,
  audio_url text not null,
  audio_key text not null,
  audio_format text not null default 'audio',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_tts_outputs_voice_source_check check (voice_source in ('custom', 'default')),
  constraint ai_tts_outputs_audio_format_check check (audio_format in ('mp3', 'wav', 'audio')),
  constraint ai_tts_outputs_character_count_check check (character_count between 0 and 2000),
  constraint ai_tts_outputs_credits_cost_check check (credits_cost >= 0)
);

create table if not exists public.ai_tts_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tts_output_id uuid references public.ai_tts_outputs(id) on delete set null,
  voice_clone_id uuid references public.ai_voice_clones(id) on delete set null,
  trigger_run_id text,
  voice_name text not null,
  voice_source text not null,
  provider_voice_id text not null default '',
  text text not null,
  character_count integer not null default 0,
  credits_cost integer not null default 0,
  status text not null default 'queued',
  progress integer not null default 0,
  message text not null default '',
  error text not null default '',
  credits_refunded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_tts_jobs_voice_source_check check (voice_source in ('custom', 'default')),
  constraint ai_tts_jobs_status_check check (status in ('queued', 'running', 'generating', 'uploading', 'completed', 'failed')),
  constraint ai_tts_jobs_progress_check check (progress between 0 and 100),
  constraint ai_tts_jobs_character_count_check check (character_count between 0 and 2000),
  constraint ai_tts_jobs_credits_cost_check check (credits_cost >= 0)
);

create table if not exists public.user_credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 1280,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_credit_balances_balance_check check (balance >= 0)
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  balance_after integer not null,
  entry_type text not null,
  description text not null default '',
  reference_type text not null default '',
  reference_id uuid,
  created_at timestamptz not null default now(),
  constraint credit_ledger_entry_type_check check (entry_type in ('debit', 'credit', 'refund'))
);

create index if not exists ai_voice_clones_user_created_idx
on public.ai_voice_clones (user_id, created_at desc);

create unique index if not exists ai_voice_clones_one_selected_per_user_idx
on public.ai_voice_clones (user_id)
where is_selected;

create index if not exists ai_voice_clone_jobs_user_created_idx
on public.ai_voice_clone_jobs (user_id, created_at desc);

create index if not exists ai_tts_outputs_user_created_idx
on public.ai_tts_outputs (user_id, created_at desc);

create index if not exists ai_tts_jobs_user_created_idx
on public.ai_tts_jobs (user_id, created_at desc);

create index if not exists credit_ledger_user_created_idx
on public.credit_ledger (user_id, created_at desc);

drop trigger if exists set_ai_voice_clones_updated_at on public.ai_voice_clones;
create trigger set_ai_voice_clones_updated_at
before update on public.ai_voice_clones
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_voice_clone_jobs_updated_at on public.ai_voice_clone_jobs;
create trigger set_ai_voice_clone_jobs_updated_at
before update on public.ai_voice_clone_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_tts_outputs_updated_at on public.ai_tts_outputs;
create trigger set_ai_tts_outputs_updated_at
before update on public.ai_tts_outputs
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_tts_jobs_updated_at on public.ai_tts_jobs;
create trigger set_ai_tts_jobs_updated_at
before update on public.ai_tts_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_credit_balances_updated_at on public.user_credit_balances;
create trigger set_user_credit_balances_updated_at
before update on public.user_credit_balances
for each row
execute function public.set_updated_at();

create or replace function public.ensure_user_credit_balance(
  p_user_id uuid,
  p_default_balance integer default 1280
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  next_balance integer;
begin
  insert into public.user_credit_balances (user_id, balance)
  values (p_user_id, greatest(p_default_balance, 0))
  on conflict (user_id) do nothing;

  select balance into next_balance
  from public.user_credit_balances
  where user_id = p_user_id;

  return coalesce(next_balance, greatest(p_default_balance, 0));
end;
$$;

create or replace function public.deduct_user_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text default '',
  p_reference_type text default '',
  p_reference_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  next_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Credit amount must be positive.';
  end if;

  perform public.ensure_user_credit_balance(p_user_id, 1280);

  update public.user_credit_balances
  set balance = balance - p_amount
  where user_id = p_user_id
    and balance >= p_amount
  returning balance into next_balance;

  if next_balance is null then
    raise exception 'Insufficient credits.';
  end if;

  insert into public.credit_ledger (
    user_id,
    amount,
    balance_after,
    entry_type,
    description,
    reference_type,
    reference_id
  )
  values (
    p_user_id,
    -p_amount,
    next_balance,
    'debit',
    coalesce(p_description, ''),
    coalesce(p_reference_type, ''),
    p_reference_id
  );

  return next_balance;
end;
$$;

create or replace function public.refund_user_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text default '',
  p_reference_type text default '',
  p_reference_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  next_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Credit amount must be positive.';
  end if;

  perform public.ensure_user_credit_balance(p_user_id, 1280);

  update public.user_credit_balances
  set balance = balance + p_amount
  where user_id = p_user_id
  returning balance into next_balance;

  insert into public.credit_ledger (
    user_id,
    amount,
    balance_after,
    entry_type,
    description,
    reference_type,
    reference_id
  )
  values (
    p_user_id,
    p_amount,
    next_balance,
    'refund',
    coalesce(p_description, ''),
    coalesce(p_reference_type, ''),
    p_reference_id
  );

  return next_balance;
end;
$$;

alter table public.ai_voice_clones enable row level security;
alter table public.ai_voice_clone_jobs enable row level security;
alter table public.ai_tts_outputs enable row level security;
alter table public.ai_tts_jobs enable row level security;
alter table public.user_credit_balances enable row level security;
alter table public.credit_ledger enable row level security;

drop policy if exists "users can read own voice clones" on public.ai_voice_clones;
drop policy if exists "users can insert own voice clones" on public.ai_voice_clones;
drop policy if exists "users can update own voice clones" on public.ai_voice_clones;
drop policy if exists "users can delete own voice clones" on public.ai_voice_clones;

create policy "users can read own voice clones"
on public.ai_voice_clones for select
using (user_id = auth.uid());

create policy "users can insert own voice clones"
on public.ai_voice_clones for insert
with check (user_id = auth.uid());

create policy "users can update own voice clones"
on public.ai_voice_clones for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete own voice clones"
on public.ai_voice_clones for delete
using (user_id = auth.uid());

drop policy if exists "users can read own voice clone jobs" on public.ai_voice_clone_jobs;
drop policy if exists "users can insert own voice clone jobs" on public.ai_voice_clone_jobs;
drop policy if exists "users can update own voice clone jobs" on public.ai_voice_clone_jobs;

create policy "users can read own voice clone jobs"
on public.ai_voice_clone_jobs for select
using (user_id = auth.uid());

create policy "users can insert own voice clone jobs"
on public.ai_voice_clone_jobs for insert
with check (user_id = auth.uid());

create policy "users can update own voice clone jobs"
on public.ai_voice_clone_jobs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can read own tts outputs" on public.ai_tts_outputs;
drop policy if exists "users can insert own tts outputs" on public.ai_tts_outputs;

create policy "users can read own tts outputs"
on public.ai_tts_outputs for select
using (user_id = auth.uid());

create policy "users can insert own tts outputs"
on public.ai_tts_outputs for insert
with check (user_id = auth.uid());

drop policy if exists "users can read own tts jobs" on public.ai_tts_jobs;
drop policy if exists "users can insert own tts jobs" on public.ai_tts_jobs;
drop policy if exists "users can update own tts jobs" on public.ai_tts_jobs;

create policy "users can read own tts jobs"
on public.ai_tts_jobs for select
using (user_id = auth.uid());

create policy "users can insert own tts jobs"
on public.ai_tts_jobs for insert
with check (user_id = auth.uid());

create policy "users can update own tts jobs"
on public.ai_tts_jobs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users can read own credit balance" on public.user_credit_balances;
drop policy if exists "users can read own credit ledger" on public.credit_ledger;

create policy "users can read own credit balance"
on public.user_credit_balances for select
using (user_id = auth.uid());

create policy "users can read own credit ledger"
on public.credit_ledger for select
using (user_id = auth.uid());
