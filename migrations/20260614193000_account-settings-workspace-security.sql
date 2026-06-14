alter table public.users
  add column if not exists phone text not null default '',
  add column if not exists description text not null default '',
  add column if not exists avatar_key text not null default '',
  add column if not exists email_notifications boolean not null default true,
  add column if not exists default_aspect_ratio text not null default '16:9',
  add column if not exists password_changed_at timestamptz,
  add column if not exists two_factor_enabled boolean not null default false,
  add column if not exists two_factor_secret_encrypted text not null default '',
  add column if not exists two_factor_pending_secret_encrypted text not null default '';

alter table public.users
  drop constraint if exists users_default_aspect_ratio_check;

alter table public.users
  add constraint users_default_aspect_ratio_check
  check (default_aspect_ratio in ('16:9', '9:16'));

alter table public.user_credit_balances
  add column if not exists plan_tier text not null default 'Free Plan',
  add column if not exists plan_status text not null default 'active',
  add column if not exists monthly_credit_allowance integer not null default 1280,
  add column if not exists monthly_credit_remaining integer not null default 1280,
  add column if not exists paid_credit_balance integer not null default 0;

alter table public.user_credit_balances
  drop constraint if exists user_credit_balances_plan_tier_check,
  drop constraint if exists user_credit_balances_plan_status_check,
  drop constraint if exists user_credit_balances_monthly_credit_allowance_check,
  drop constraint if exists user_credit_balances_monthly_credit_remaining_check,
  drop constraint if exists user_credit_balances_paid_credit_balance_check;

alter table public.user_credit_balances
  add constraint user_credit_balances_plan_tier_check
  check (plan_tier in ('Free Plan', 'Pro Plan', 'Max Plan')),
  add constraint user_credit_balances_plan_status_check
  check (plan_status in ('active', 'inactive', 'past_due', 'canceled')),
  add constraint user_credit_balances_monthly_credit_allowance_check
  check (monthly_credit_allowance >= 0),
  add constraint user_credit_balances_monthly_credit_remaining_check
  check (monthly_credit_remaining >= 0),
  add constraint user_credit_balances_paid_credit_balance_check
  check (paid_credit_balance >= 0);

update public.user_credit_balances
set
  monthly_credit_allowance = greatest(monthly_credit_allowance, 1280),
  monthly_credit_remaining = greatest(balance - paid_credit_balance, 0),
  balance = greatest(balance, 0)
where monthly_credit_remaining = 1280
  and paid_credit_balance = 0;

create table if not exists public.user_two_factor_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_payload text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_two_factor_challenges_user_created_idx
on public.user_two_factor_challenges (user_id, created_at desc);

alter table public.user_two_factor_challenges enable row level security;

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
  insert into public.user_credit_balances (
    user_id,
    balance,
    monthly_credit_allowance,
    monthly_credit_remaining,
    paid_credit_balance
  )
  values (
    p_user_id,
    greatest(p_default_balance, 0),
    greatest(p_default_balance, 0),
    greatest(p_default_balance, 0),
    0
  )
  on conflict (user_id) do nothing;

  update public.user_credit_balances
  set balance = greatest(monthly_credit_remaining, 0) + greatest(paid_credit_balance, 0)
  where user_id = p_user_id
  returning balance into next_balance;

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
  current_monthly integer;
  current_paid integer;
  monthly_debit integer;
  paid_debit integer;
  next_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Credit amount must be positive.';
  end if;

  perform public.ensure_user_credit_balance(p_user_id, 1280);

  select monthly_credit_remaining, paid_credit_balance
  into current_monthly, current_paid
  from public.user_credit_balances
  where user_id = p_user_id
  for update;

  if coalesce(current_monthly, 0) + coalesce(current_paid, 0) < p_amount then
    raise exception 'Insufficient credits.';
  end if;

  monthly_debit := least(current_monthly, p_amount);
  paid_debit := p_amount - monthly_debit;

  update public.user_credit_balances
  set
    monthly_credit_remaining = monthly_credit_remaining - monthly_debit,
    paid_credit_balance = paid_credit_balance - paid_debit,
    balance = (monthly_credit_remaining - monthly_debit) + (paid_credit_balance - paid_debit)
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
  set
    paid_credit_balance = paid_credit_balance + p_amount,
    balance = monthly_credit_remaining + paid_credit_balance + p_amount
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

create or replace function public.add_paid_credits(
  p_user_id uuid,
  p_amount integer,
  p_description text default 'Paid credit recharge',
  p_reference_type text default 'paid_credit_recharge',
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
  set
    paid_credit_balance = paid_credit_balance + p_amount,
    balance = monthly_credit_remaining + paid_credit_balance + p_amount
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
    'credit',
    coalesce(p_description, ''),
    coalesce(p_reference_type, ''),
    p_reference_id
  );

  return next_balance;
end;
$$;

create or replace function public.delete_user_account_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from public.users where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.delete_user_account_admin(uuid) from public, anon, authenticated;
