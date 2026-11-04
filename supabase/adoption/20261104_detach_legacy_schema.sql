-- One-time adoption of the unversioned casino schema (2026-11-04).
--
-- Before Sprint 5 the `casino_*` tables, two RPCs and the `user_profiles` view
-- were created by hand in the Supabase SQL editor. The versioned baseline
-- migration assumes it owns those names, so the live objects have to step
-- aside once, without losing the demo data they hold.
--
-- This script only *detaches* the tables: it moves them, with their indexes and
-- constraints, into the `legacy_20261104` schema. It is safe to re-run (the
-- `if exists`/`if not exists` guards make the second run a no-op).
--
-- Full adoption sequence:
--   1. run this script;
--   2. apply `supabase/migrations/20261103000000_init_casino_schema.sql`
--      (`supabase db push --remote`, or the SQL editor);
--   3. copy the rows back with the restore script generated from the pre-flight
--      backup. That script is deliberately **not** committed: it contains user
--      data. See `docs/handoff-crypto-casino.md` §1 for the column mapping;
--   4. verify counts, then `drop schema legacy_20261104 cascade;`.
--
-- The baseline migration itself drops the pre-versioning `update_user_balance`
-- (`returns void` -> `returns jsonb`) and `user_profiles` view, so this script
-- does not need to touch them.

begin;

create schema if not exists legacy_20261104;

alter table if exists public.casino_profiles
    set schema legacy_20261104;
alter table if exists public.casino_wallets
    set schema legacy_20261104;
alter table if exists public.casino_transactions
    set schema legacy_20261104;
alter table if exists public.casino_bets
    set schema legacy_20261104;
alter table if exists public.casino_house_stats
    set schema legacy_20261104;

commit;
