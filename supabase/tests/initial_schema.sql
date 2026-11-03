-- Behavioural checks for the initial schema, run by
-- `scripts/validate-migration.sh` against a throwaway Postgres.
-- Everything is rolled back; the database is left untouched.

begin;

insert into auth.users (id, email, email_confirmed_at)
values
    ('11111111-1111-1111-1111-111111111111', 'alice@example.com', now()),
    ('22222222-2222-2222-2222-222222222222', 'bob@example.com', null);

insert into public.casino_profiles (user_id, email, username)
values ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'alice');

-- update_user_balance credits, debits, and keeps currency buckets apart.
select public.update_user_balance(
    '11111111-1111-1111-1111-111111111111', 'ETH', 1.5
);
select public.update_user_balance(
    '11111111-1111-1111-1111-111111111111', 'ETH', -0.5
);
select public.update_user_balance(
    '11111111-1111-1111-1111-111111111111', 'USDT', 25
);

do $$
declare
    b jsonb;
begin
    select balance into b
      from public.casino_profiles
     where user_id = '11111111-1111-1111-1111-111111111111';

    if b ->> 'ETH' <> '1.00000000' or b ->> 'USDT' <> '25.00000000' then
        raise exception 'unexpected balance map: %', b;
    end if;
end;
$$;

-- A debit below zero must be rejected.
do $$
begin
    perform public.update_user_balance(
        '11111111-1111-1111-1111-111111111111', 'ETH', -99
    );
    raise exception 'negative balance guard did not fire';
exception
    when check_violation then
        raise notice 'negative balance guard ok';
end;
$$;

-- A missing profile must raise, not silently create one.
do $$
begin
    perform public.update_user_balance(
        '99999999-9999-9999-9999-999999999999', 'ETH', 1
    );
    raise exception 'missing profile was accepted';
exception
    when no_data_found then
        raise notice 'missing profile rejected';
end;
$$;

-- update_house_stats upserts and accumulates.
select public.update_house_stats('dice', 'ETH', 1.0, 1.98);
select public.update_house_stats('dice', 'ETH', 2.0, 0);

do $$
declare
    r record;
begin
    select * into r
      from public.casino_house_stats
     where game_type = 'dice' and currency = 'ETH';

    if r.rounds <> 2 or r.total_wagered <> 3.0 or r.total_paid <> 1.98 then
        raise exception 'unexpected house stats: %', r;
    end if;
end;
$$;

-- get_user_by_email is case-insensitive and returns at most one row.
do $$
declare
    r record;
begin
    select * into r from public.get_user_by_email('ALICE@example.com');
    if r.id <> '11111111-1111-1111-1111-111111111111' or r.username <> 'alice' then
        raise exception 'unexpected email lookup: %', r;
    end if;

    if (select count(*) from public.get_user_by_email('nobody@example.com')) <> 0 then
        raise exception 'email lookup should return no rows';
    end if;
end;
$$;

-- Deposit replay guard: one row per blockchain tx hash.
insert into public.casino_transactions (
    user_id, transaction_type, currency, amount, status, metadata
)
values (
    '11111111-1111-1111-1111-111111111111', 'deposit', 'ETH', 1.0, 'confirmed',
    '{"tx_hash": "0xabc"}'
);

do $$
begin
    insert into public.casino_transactions (
        user_id, transaction_type, currency, amount, status, metadata
    )
    values (
        '11111111-1111-1111-1111-111111111111', 'deposit', 'ETH', 1.0,
        'confirmed', '{"tx_hash": "0xabc"}'
    );
    raise exception 'duplicate tx_hash was accepted';
exception
    when unique_violation then
        raise notice 'duplicate tx_hash blocked';
end;
$$;

-- metadata must be a jsonb object.
do $$
begin
    insert into public.casino_transactions (
        user_id, transaction_type, currency, amount, status, metadata
    )
    values (
        '11111111-1111-1111-1111-111111111111', 'deposit', 'ETH', 1.0,
        'pending', '"a string"'
    );
    raise exception 'non-object metadata was accepted';
exception
    when check_violation then
        raise notice 'non-object metadata blocked';
end;
$$;

rollback;
