#!/usr/bin/env bash
# Applies supabase/migrations/*.sql to a throwaway Postgres, runs the SQL tests
# in supabase/tests/, and checks the anon/service-role permission posture.
#
# This is a local safety net, not part of CI (CI has no Supabase project). It
# needs Docker and a local postgres image. Set PG_IMAGE to override the tag.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
MIGRATIONS_DIR="$ROOT/supabase/migrations"
TESTS_DIR="$ROOT/supabase/tests"
PG_IMAGE=${PG_IMAGE:-postgres:18.3}
CT=${CT:-crypto-casino-migration-check}

cleanup() { docker rm -f "$CT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required for this check" >&2
    exit 1
fi

cleanup
docker run --rm -d --name "$CT" \
    -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=casino \
    "$PG_IMAGE" >/dev/null

for _ in $(seq 1 90); do
    if docker exec -i "$CT" psql -U postgres -d casino -c 'select 1' >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

psql_run() {
    docker exec -i "$CT" psql -v ON_ERROR_STOP=1 -U postgres -d casino "$@"
}

# Objects Supabase owns that the migrations reference.
psql_run >/dev/null <<'SQL'
create schema auth;
create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email varchar(255),
    email_confirmed_at timestamptz,
    created_at timestamptz not null default now()
);
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
SQL

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
tests=("$TESTS_DIR"/*.sql)
shopt -u nullglob

if [ ${#migrations[@]} -eq 0 ]; then
    echo "no migrations found in $MIGRATIONS_DIR" >&2
    exit 1
fi

for file in "${migrations[@]}"; do
    echo "applying $(basename "$file")"
    psql_run -f - < "$file" >/dev/null
done

for file in "${tests[@]}"; do
    echo "testing $(basename "$file")"
    psql_run -f - < "$file" >/dev/null
done

echo "checking permissions"
if psql_run -c 'set role anon; select count(*) from public.casino_profiles;' >/dev/null 2>&1; then
    echo "FAIL: anon can read casino_profiles (RLS/grants regression)" >&2
    exit 1
fi
if psql_run -c 'set role anon; select count(*) from public.casino_sessions;' >/dev/null 2>&1; then
    echo "FAIL: anon can read casino_sessions (RLS/grants regression)" >&2
    exit 1
fi
psql_run -c "set role anon; select username from public.get_user_by_email('alice@example.com');" >/dev/null
psql_run -c 'set role service_role; select count(*) from public.casino_bets;' >/dev/null
psql_run -c 'set role service_role; select count(*) from public.casino_sessions;' >/dev/null

echo "migration checks passed"
