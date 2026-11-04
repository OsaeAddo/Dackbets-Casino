-- Initial casino schema (Sprint 5).
--
-- Apply with `supabase db push` or paste into the Supabase SQL editor. The
-- schema mirrors the table names, columns, RPC signatures and PostgREST
-- filters used by `backend/app`.
--
-- Security posture: RLS is enabled with **no** anon/authenticated policies.
-- The API reaches these tables through the service-role client only; the single
-- anon-callable function is `get_user_by_email`, which returns at most the one
-- row matching the supplied address.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.casino_profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users (id) on delete cascade,
    email text not null,
    username text,
    -- Per-currency maps, e.g. {"ETH": 1.25, "USDT": 500}
    balance jsonb not null default '{}'::jsonb
        check (jsonb_typeof(balance) = 'object'),
    total_wagered jsonb not null default '{}'::jsonb
        check (jsonb_typeof(total_wagered) = 'object'),
    total_won jsonb not null default '{}'::jsonb
        check (jsonb_typeof(total_won) = 'object'),
    kyc_status text not null default 'pending'
        check (kyc_status in ('pending', 'verified', 'rejected')),
    level integer not null default 1 check (level >= 1),
    wagering_requirement numeric(24, 8) not null default 0
        check (wagering_requirement >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.casino_wallets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    currency text not null check (char_length(currency) between 1 and 16),
    address text not null check (char_length(address) > 0),
    balance numeric(24, 8) not null default 0 check (balance >= 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint casino_wallets_user_currency_key unique (user_id, currency),
    -- Deposit webhooks resolve a wallet by (currency, address).
    constraint casino_wallets_currency_address_key unique (currency, address)
);

create table if not exists public.casino_transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    transaction_type text not null
        check (transaction_type in ('deposit', 'withdrawal', 'bet', 'win', 'bonus', 'refund')),
    currency text not null check (char_length(currency) between 1 and 16),
    amount numeric(24, 8) not null check (amount >= 0),
    status text not null default 'pending'
        check (status in ('pending', 'confirmed', 'failed', 'cancelled')),
    metadata jsonb not null default '{}'::jsonb
        check (jsonb_typeof(metadata) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.casino_bets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    game_type text not null check (char_length(game_type) between 1 and 32),
    currency text not null check (char_length(currency) between 1 and 16),
    amount numeric(24, 8) not null check (amount > 0),
    result jsonb not null default '{}'::jsonb,
    win_amount numeric(24, 8) not null default 0 check (win_amount >= 0),
    timestamp timestamptz not null default now()
);

create table if not exists public.casino_house_stats (
    game_type text not null,
    currency text not null,
    total_wagered numeric(24, 8) not null default 0 check (total_wagered >= 0),
    total_paid numeric(24, 8) not null default 0 check (total_paid >= 0),
    rounds bigint not null default 0 check (rounds >= 0),
    updated_at timestamptz not null default now(),
    primary key (game_type, currency)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists casino_profiles_email_idx
    on public.casino_profiles (lower(email));

create index if not exists casino_bets_user_time_idx
    on public.casino_bets (user_id, timestamp desc);

create index if not exists casino_bets_game_type_idx
    on public.casino_bets (game_type);

create index if not exists casino_transactions_user_time_idx
    on public.casino_transactions (user_id, created_at desc);

create index if not exists casino_transactions_status_idx
    on public.casino_transactions (status);

-- Blockchain tx ids live in metadata. The unique partial index is the DB-level
-- guard against replaying a deposit webhook and double-crediting a user.
create unique index if not exists casino_transactions_tx_hash_uidx
    on public.casino_transactions ((metadata ->> 'tx_hash'))
    where metadata ? 'tx_hash';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

drop trigger if exists casino_profiles_set_updated_at on public.casino_profiles;
create trigger casino_profiles_set_updated_at
    before update on public.casino_profiles
    for each row execute function public.set_updated_at();

drop trigger if exists casino_wallets_set_updated_at on public.casino_wallets;
create trigger casino_wallets_set_updated_at
    before update on public.casino_wallets
    for each row execute function public.set_updated_at();

drop trigger if exists casino_transactions_set_updated_at on public.casino_transactions;
create trigger casino_transactions_set_updated_at
    before update on public.casino_transactions
    for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Atomically add `p_amount` to one currency bucket of a profile balance.
-- Raises if the profile is missing or the result would go negative.
--
-- Pre-versioning databases defined this RPC as `returns void`; PostgreSQL cannot
-- change a function's return type with `create or replace`, so drop it first
-- (safe on a fresh database).
drop function if exists public.update_user_balance(uuid, text, numeric);

create or replace function public.update_user_balance(
    p_user_id uuid,
    p_currency text,
    p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_balance jsonb;
    v_new numeric;
begin
    if p_currency is null or char_length(p_currency) = 0 then
        raise exception 'currency is required' using errcode = '22004';
    end if;
    if p_amount is null then
        raise exception 'amount is required' using errcode = '22004';
    end if;

    select balance
      into v_balance
      from public.casino_profiles
     where user_id = p_user_id
       for update;

    if not found then
        raise exception 'profile not found for user %', p_user_id using errcode = 'P0002';
    end if;

    v_new := round(coalesce((v_balance ->> p_currency)::numeric, 0) + p_amount, 8);

    if v_new < 0 then
        raise exception 'insufficient % balance', p_currency using errcode = '23514';
    end if;

    update public.casino_profiles
       set balance = jsonb_set(v_balance, array[p_currency], to_jsonb(v_new), true),
           updated_at = now()
     where user_id = p_user_id;

    return jsonb_build_object(
        'user_id', p_user_id,
        'currency', p_currency,
        'balance', v_new
    );
end;
$$;

revoke all on function public.update_user_balance(uuid, text, numeric)
    from public, anon, authenticated;
grant execute on function public.update_user_balance(uuid, text, numeric)
    to service_role;

-- Accumulate house totals per (game, currency).
create or replace function public.update_house_stats(
    p_game_type text,
    p_currency text,
    p_wagered numeric,
    p_paid numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.casino_house_stats (
        game_type, currency, total_wagered, total_paid, rounds
    )
    values (
        p_game_type, p_currency, coalesce(p_wagered, 0), coalesce(p_paid, 0), 1
    )
    on conflict (game_type, currency) do update
       set total_wagered = public.casino_house_stats.total_wagered
                           + excluded.total_wagered,
           total_paid = public.casino_house_stats.total_paid
                        + excluded.total_paid,
           rounds = public.casino_house_stats.rounds + 1,
           updated_at = now();
end;
$$;

revoke all on function public.update_house_stats(text, text, numeric, numeric)
    from public, anon, authenticated;
grant execute on function public.update_house_stats(text, text, numeric, numeric)
    to service_role;

-- Email lookup used by `/api/auth/check-verification`. Scoped to one address so
-- anon callers cannot enumerate the auth table.
create or replace function public.get_user_by_email(p_email text)
returns table (
    id uuid,
    email text,
    email_confirmed_at timestamptz,
    created_at timestamptz,
    username text
)
language sql
security definer
stable
set search_path = ''
as $$
    select
        u.id,
        u.email::text,
        u.email_confirmed_at,
        u.created_at,
        p.username
    from auth.users u
    left join public.casino_profiles p on p.user_id = u.id
    where lower(u.email) = lower(p_email)
    limit 1;
$$;

revoke all on function public.get_user_by_email(text) from public;
grant execute on function public.get_user_by_email(text)
    to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Admin/service-role view joining the auth record to the casino profile.
-- Deliberately not granted to anon/authenticated: it exposes every user's
-- email address. Application code uses `get_user_by_email` instead.
--
-- Pre-versioning databases had a different `user_profiles` view (plain
-- auth.users select) whose `email` column was `varchar`; `create or replace
-- view` cannot change column types, so drop the old definition first.
drop view if exists public.user_profiles;

create or replace view public.user_profiles
with (security_invoker = false) as
select
    u.id,
    u.email::text as email,
    u.email_confirmed_at,
    u.created_at,
    p.username
from auth.users u
left join public.casino_profiles p on p.user_id = u.id;

revoke all on public.user_profiles from public, anon, authenticated;
grant select on public.user_profiles to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.casino_profiles enable row level security;
alter table public.casino_wallets enable row level security;
alter table public.casino_transactions enable row level security;
alter table public.casino_bets enable row level security;
alter table public.casino_house_stats enable row level security;

-- Deny-by-default for anon/authenticated. `service_role` bypasses RLS, so all
-- table access flows through the backend's service-role client.
revoke all on public.casino_profiles from public, anon, authenticated;
revoke all on public.casino_wallets from public, anon, authenticated;
revoke all on public.casino_transactions from public, anon, authenticated;
revoke all on public.casino_bets from public, anon, authenticated;
revoke all on public.casino_house_stats from public, anon, authenticated;

grant all on public.casino_profiles to service_role;
grant all on public.casino_wallets to service_role;
grant all on public.casino_transactions to service_role;
grant all on public.casino_bets to service_role;
grant all on public.casino_house_stats to service_role;
