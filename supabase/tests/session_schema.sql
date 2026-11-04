-- Behavioural checks for the refresh-session table, run by
-- `scripts/validate-migration.sh` against a throwaway Postgres.
-- Everything is rolled back.

begin;

insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'session@example.com');

-- A rotated session keeps its family and records the replacement.
insert into public.casino_sessions (id, user_id, token_hash, family_id, expires_at)
values (
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    repeat('a', 64),
    '55555555-5555-5555-5555-555555555555',
    now() + interval '30 days'
);

insert into public.casino_sessions (
    user_id, token_hash, family_id, expires_at, replaced_by
)
values (
    '33333333-3333-3333-3333-333333333333',
    repeat('b', 64),
    '55555555-5555-5555-5555-555555555555',
    now() + interval '30 days',
    '44444444-4444-4444-4444-444444444444'
);

-- The refresh token hash must be unique (rotation/replay guard).
do $$
begin
    insert into public.casino_sessions (user_id, token_hash, expires_at)
    values (
        '33333333-3333-3333-3333-333333333333',
        repeat('a', 64),
        now() + interval '1 day'
    );
    raise exception 'duplicate token_hash was accepted';
exception
    when unique_violation then
        raise notice 'duplicate token_hash guard ok';
end;
$$;

-- A malformed hash (not SHA-256 hex) must be rejected.
do $$
begin
    insert into public.casino_sessions (user_id, token_hash, expires_at)
    values ('33333333-3333-3333-3333-333333333333', 'too-short', now() + interval '1 day');
    raise exception 'short token_hash was accepted';
exception
    when check_violation then
        raise notice 'token_hash length guard ok';
end;
$$;

-- Expiry must be after creation.
do $$
begin
    insert into public.casino_sessions (user_id, token_hash, expires_at)
    values (
        '33333333-3333-3333-3333-333333333333',
        repeat('c', 64),
        now() - interval '1 day'
    );
    raise exception 'expired-at-creation session was accepted';
exception
    when check_violation then
        raise notice 'expiry guard ok';
end;
$$;

rollback;
