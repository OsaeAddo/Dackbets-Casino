-- Session hardening (Sprint 7).
--
-- Server-side refresh-token sessions back the HttpOnly cookie flow. Only the
-- SHA-256 hash of a refresh token is stored, so a database read cannot mint a
-- session. Rotation is enforced by the unique `token_hash` and by claiming the
-- old row (`revoked_at is null`) before a replacement is issued; presenting an
-- already-revoked token revokes the whole family (reuse detection).
--
-- Security posture matches the rest of the casino schema: RLS is enabled with
-- no anon/authenticated policies, and only the service role may touch the table.

create table if not exists public.casino_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    -- Hex SHA-256 of the opaque refresh token. Never store the token itself.
    token_hash text not null unique
        check (char_length(token_hash) = 64),
    -- All rotations of one login share a family so reuse can revoke them all.
    family_id uuid not null default gen_random_uuid(),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    replaced_by uuid references public.casino_sessions (id) on delete set null,
    constraint casino_sessions_expiry_after_creation
        check (expires_at > created_at)
);

create index if not exists casino_sessions_user_idx
    on public.casino_sessions (user_id, created_at desc);

create index if not exists casino_sessions_family_idx
    on public.casino_sessions (family_id);

create index if not exists casino_sessions_expiry_idx
    on public.casino_sessions (expires_at);

alter table public.casino_sessions enable row level security;

revoke all on public.casino_sessions from public, anon, authenticated;
grant all on public.casino_sessions to service_role;
