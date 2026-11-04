# Handoff — crypto-casino

Prepared: 2026-11-03
Repo: `OsaeAddo/crypto-casino`
Remote: `git@github.com:OsaeAddo/crypto-casino.git`

This file is versioned with the code and is the authoritative copy. Agent working rules
live in [`AGENTS.md`](../AGENTS.md).

This document is the entry point for a **new session in the same workspace**. Read
sections 1–3 before touching anything. Section 6 is the immediate work order.

---

## 1. Current state (verified 2026-11-04, Sprint 5 merged and schema applied)

| Item | Value |
| --- | --- |
| Branch | `sprint/06-security-phase-1` (Phase 1 security, PR pending) |
| HEAD | see `git log --oneline -1` |
| Sync | branched from `main` @ `290b3a0` (merge PR #7, live-schema adoption) |
| Working tree | in progress — see Sprint 6 below |
| CI on `main` | success on `290b3a0` |
| Open PRs | none yet for Sprint 6 |
| Dependabot | **1 open** (was 210) — moderate `minimatch@3.1.5` in 6 dev-only eslint nodes; fixed upstream in 11.0.1, no 3.x patch. Accepted, see §5.8 |
| Migrations | **`supabase/migrations/20261103000000_init_casino_schema.sql`** — applied to project `kebogkndtbkwukdyavfz` (DackBets Casino) |
| Migration history | `supabase_migrations.schema_migrations` has `20261103000000 / init_casino_schema` |
| Stale remote branch | `origin/sprint/01-foundation` still exists (merged, never deleted) |
| Secrets | `backend/.env` is gitignored (`git check-ignore` confirms); `frontend/.env.local` ignored; `supabase/.temp/` now ignored |

### Sprint 6 progress (`sprint/06-security-phase-1`)

Goal: close the Phase 1 security gaps in §4b. One commit per item.

- [x] **`check-verification` bypass removed.** `POST /api/auth/check-verification`
      is gone (404). `POST /api/auth/verify-email` now exchanges a real Supabase
      confirmation token (`token_hash`, or `token` + `email` for OTP) via
      `db.verify_email_token()`; invalid/expired/reused tokens return 400 and no JWT.
      The verify-email page no longer auto-mints a token from an email address; it
      links to sign-in instead. Tests: `backend/tests/test_security.py`.
- [x] **Admin auth.** `/api/admin/*` now requires `X-Admin-Key`, compared in
      constant time against `ADMIN_API_KEY`; the API returns 503 when the key is
      unset (fail closed) and 403 on a missing/wrong key. The two route paths were
      also corrected from `/api/adminstats` and `/api/adminusers/...` to
      `/api/admin/stats` and `/api/admin/users/...`.
- [x] **Webhook HMAC.** `/api/webhooks/tatum/deposit` verifies `x-payload-hash`
      (Tatum, HMAC-SHA512) or `X-Webhook-Signature` (`sha256=<hex>`) over the raw
      body before parsing, with constant-time comparison; 503 when
      `WEBHOOK_HMAC_SECRET` is unset and 401 when the signature is missing/wrong.
      `/api/webhooks/test/*` is 404 unless `ENABLE_TEST_WEBHOOKS=true`, and always
      requires `X-Admin-Key`.
- [ ] Deposit duplicate-race handling
- [ ] Deposit duplicate-race handling
- [ ] Final `scripts/verify.sh` on Python 3.12 / Node 22 + open PR

### Live schema adoption (2026-11-04)

The Supabase project already had the five `casino_*` tables, two RPCs and a
`user_profiles` view from the pre-versioning sprints. Applying the baseline failed:

- `update_user_balance` existed as `returns void`, so `create or replace` raised
  `SQLSTATE 42P13 cannot change return type of existing function`;
- `user_profiles` selected straight from `auth.users` (`email` was `varchar`), so
  `create or replace view` would also have failed;
- `create table if not exists` silently skipped the drifted tables (nullable columns,
  no precision/checks, missing `updated_at`, `house_stats` with `id`/`profit` and no
  composite PK, missing `rounds`).

Adopted **without data loss** (4 profiles / 10 wallets / 13 transactions / 13 bets /
1 house row copied, counts verified afterwards):

1. `supabase/adoption/20261104_detach_legacy_schema.sql` moved the five tables into
   `legacy_20261104` (indexes/constraints follow the table).
2. The baseline was applied via `supabase db query --remote --file` (the CLI's
   `db push --remote` needs the DB password; the login-role route is blocked on this
   project). Row mapping: `wallets.updated_at = created_at`,
   `transactions.updated_at = created_at`, `house_stats.rounds = 0`, `profit` dropped.
3. Verified: row counts, function return types, only `casino_profiles.username`
   nullable, all checks/unique indexes/triggers present, RLS on, 0 policies,
   `anon` denied on every table/view and on both mutating RPCs, service role allowed.
   Live probes: service-role REST read `200`, anon read `401 / 42501`.
4. Recorded the version in `supabase_migrations.schema_migrations`, then dropped
   `legacy_20261104`. The pre-adoption row backup lives only in `/tmp/opencode`
   (ephemeral, and it contains user data — never commit it).

The baseline now drops the pre-versioning `update_user_balance` and `user_profiles`
view before creating them, so a partial/pre-versioned database can be adopted by a
plain `db push` (guards are no-ops on a fresh database). `supabase/.temp/` is ignored.


### Sprint 5 progress (`sprint/05-supabase-migrations`)

Goal: make the schema explicit and reproducible (§4a). Verified locally with
Python **3.12.13** and Node **22.20.0**, plus a throwaway **Postgres 18.3**
container for the SQL.

- [x] `supabase/migrations/20261103000000_init_casino_schema.sql`: five tables
      (`casino_profiles`, `casino_wallets`, `casino_transactions`, `casino_bets`,
      `casino_house_stats`), FKs to `auth.users`, JSONB balance maps, RPCs
      `update_user_balance` / `update_house_stats` / `get_user_by_email`, the
      `user_profiles` view, updated_at triggers, and indexes for wallet lookup,
      bet history, transaction history and `metadata->>'tx_hash'`
- [x] Deposit replay guard: unique partial index on `metadata->>'tx_hash'`; the
      old check was application-only
- [x] RLS decision: **enabled deny-by-default** on all five tables. `anon` and
      `authenticated` have no table grants; the API uses the service-role client.
      The only anon-callable object is the address-scoped `get_user_by_email` RPC
      (the view is service-role only, because it exposes every email)
- [x] Backend alignment: games/profile/webhooks/wallet now use `db.casino_client`
      / `casino_models.client` (service role); a missing `SUPABASE_SECRET_KEY`
      raises `AdminClientUnavailableError` instead of a vague permission error
- [x] `create_transaction` now sends `metadata` as a JSON object. It previously
      sent `json.dumps(...)`, i.e. a JSON string, so the `->>` dedupe filter
      would never match
- [x] `get_user_by_email` uses the scoped RPC rather than selecting the all-user
      view
- [x] `supabase/tests/initial_schema.sql` + `backend/tests/test_schema_contract.py`
      pin RPC names/params and the Python ↔ SQL contract
- [x] `scripts/validate-migration.sh` applies all migrations + SQL tests to a
      throwaway Postgres and checks the anon/service-role posture
- [x] Final `scripts/verify.sh` on Python 3.12 / Node 22 and open PR

Local evidence:
- `./scripts/validate-migration.sh` — migration applied; negative-balance guard,
  missing-profile guard, house-stat accumulation, case-insensitive email lookup,
  duplicate `tx_hash` and non-object metadata checks all fired; anon denied on
  tables, allowed only on `get_user_by_email`
- `ruff check app tests` clean; `pytest -q` **14 passed** (8 before, +6 contract tests)

### Sprint 4 final gate (merged)

- [x] §5.5.2 remove `shadcn` / `minimatch` / `zod` — `shadcn` was not JS-unused: `app/globals.css`
      imported `shadcn/tailwind.css`. That preset is now vendored at
      `frontend/app/shadcn-tailwind.css` (provenance comment included). Lockfile shrank by
      ~3.6k lines. verify.sh green (18 pages).
- [x] §5.5.3 `next@16.4.4`, `axios@1.21.0`, `eslint-config-next@16.4.4` — the new
      `eslint-config-next` enables `react-hooks/set-state-in-effect` and
      `@next/next/no-location-assign-relative-destination`. Fixed 12 findings: single
      `winChance` state on dice (the chance/target pair was always equal), render-phase
      stake reset, cancellable async effect bodies, `useCallback` loaders, and an absolute
      redirect URL in the axios 401 interceptor. verify.sh green.
- [x] §5.5.4 + §5.5.5 dev chain refresh + targeted `overrides` — `eslint@9.39.5`
      (latest 9.x, intentionally not 10.x). Overrides: `brace-expansion@1` 1.1.21,
      `minimatch@3` 3.1.5, `minimatch@10` **11.0.4** (typescript-estree upstream still
      pins `^10.2.2`; 11 ships a CJS build and lint is green), `browserslist` 4.28.7,
      `flatted` 3.4.2, `js-yaml` 4.3.2, `picomatch@4` 4.0.4, `source-map-js` 1.2.2,
      `ajv@6` 6.14.0, `@humanfs/node` 0.16.8.
      `npm audit`: **32 vulnerable nodes (2 critical / 22 high) → 15, all moderate**, no
      critical or high left. Remaining set is the eslint lint chain only
      (`eslint-utils` has no fixed release; `minimatch@3` is only patched at 11.x, so the
      `^3.1.x` parents keep one moderate node). verify.sh green.
- [x] §5.5.6 PyJWT migration — `backend/app/auth.py` now imports `jwt` /
      `jwt.InvalidTokenError`; `requirements.txt` drops `python-jose[cryptography]` and pins
      `PyJWT==2.15.1`. Proven by uninstalling `python-jose`, `jose`, `ecdsa`, `rsa`, `pyasn1`
      from the 3.12 venv: `pip check` clean, 8 tests pass (the JWT fallback test round-trips
      encode/decode).
- [x] §5.5.7 final `verify.sh` on Python 3.12 / Node 22 + open PR → **PR #5**

Final gate evidence (Sprint 4 session, CI-matching runtimes):
- clean-room backend: fresh 3.12 venv + `requirements*.txt`, `pip check` clean, 8 tests pass
- frontend: `npm ci` from the updated lockfile, then `verify.sh` — eslint 0/0,
  tsc clean, `next build` 18/18 pages
- `npm audit`: 15 moderate nodes, 0 critical/high; **Dependabot still shows 210 open** —
  alerts only close when the fix lands on the default branch

### Local toolchain does NOT match CI

Last session's helpers were in `/tmp/opencode`, which **was wiped**. Recreate them:

- CI: Python **3.12**, Node **22**
- Local now: Python **3.14.9**, Node **v26.13.0**, `backend/.venv` is 3.14
- `scripts/verify.sh` accepts `PYTHON=<path>`; it does not pin Node, so Node 22 must
  come from the environment (nvm/fnm, or a downloaded tarball under `/tmp/opencode`)

A green local run on 3.14/26 is *evidence*, not CI parity. Do not claim parity without
actually running 3.12/22.

---

## 2. What is done

### Sprint 1 — foundation (PR #2, merge `d9f6521`)
- Pinned dependencies and added `.env.example` templates for both apps
- CORS aligned to `localhost:3000` plus configurable extra origins (`FRONTEND_URLS`)
- Signup contract stabilized; `CasinoUser` normalized; `SignupResponse` schema added
- Per-currency bet limits enforced
- Turbopack root scoped so production `next build` works

### Sprint 2 — quality gate (PR #3, merge `8f25223`)
- `backend/pyproject.toml`: Ruff config, `ruff==0.17.3` pinned, `target-version = "py311"`,
  `B008` ignored **only** for `app/api/*.py` (FastAPI `Depends`/`Header` defaults)
- Backend lint **179 → 0**
- `BLE001` kept enabled globally; 20 reviewed boundary handlers carry individual
  `# noqa: BLE001 - <reason>` justifications instead of a blanket ignore
- Frontend **13 errors / 44 warnings → 0 / 0**; `npm run lint` is
  `eslint . --max-warnings 0`; all 5 `exhaustive-deps` fixed, not suppressed
- `.github/workflows/ci.yml`: backend (3.12) lint + pytest; frontend (22) lint + tsc +
  build; concurrency cancellation; `permissions: contents: read`; job timeouts;
  triggers on `main` push and all PRs
- `scripts/verify.sh`: one-shot local CI equivalent, logs to `/tmp/opencode`
- README verification docs

Verified at merge: `ruff` clean, `pytest` 8 passed, `tsc` clean, `next build` 18 pages.

### Sprint 4 — dependency remediation (branch `sprint/04-dependency-remediation`)
- Removed unused `shadcn` (vendored its Tailwind preset), `minimatch`, `zod`
- `next` 16.1.6 → 16.4.4, `axios` 1.13.5 → 1.21.0, `eslint-config-next` 16.4.4
- `eslint` 9.39.5; targeted `overrides` for the residual dev-only advisories
- `python-jose` → `PyJWT` 2.15.1
- `npm audit`: 32 vulnerable nodes (2 critical / 22 high) → 15 nodes, all moderate
- 12 new lint findings from the upgraded `eslint-config-next` (React Compiler rules) fixed
  without suppressions

### Sprint 5 — Supabase migrations (PR #6, merge `2f2c0ff`) + live adoption
- Versioned schema under `supabase/migrations/`, with SQL behaviour tests and a
  `scripts/validate-migration.sh` harness that runs against a throwaway Postgres
- Deny-by-default RLS; all casino table access now uses the service-role client
- DB-level deposit replay guard via a unique partial index on `metadata->>'tx_hash'`
- `metadata` is written as JSONB (was a JSON string); email lookup is an
  address-scoped RPC instead of an all-users view
- `pytest` 8 → 14 (contract tests pin RPC names/params)
- 2026-11-04: baseline applied to the live project after adopting the pre-versioning
  tables (see §1); `update_user_balance` is now `returns jsonb` and the RPCs are
  `security definer` with an empty `search_path`

### Delivered artifacts that still exist
- Git history and the PRs above (the review packets in `/tmp/opencode` are gone)
- `README.md`, `.github/workflows/ci.yml`, `scripts/verify.sh`, `backend/pyproject.toml`,
  `backend/requirements-dev.txt`, `frontend/package.json`
- `supabase/migrations/`, `supabase/tests/`, `supabase/adoption/`,
  `scripts/validate-migration.sh`

---

## 3. Working agreements (carry forward)

- Sprint branch off `main`; deliver a **ready-for-review PR, then stop**. The user merges.
- Commit after each logical step; keep evidence/logs in `/tmp/opencode`.
- Quota-conscious: prefer one verification run over repeated rebuilds.
- Never commit `.env` or secrets; only `.env.example` is tracked.
- Repo style: `logging.getLogger(__name__)`, Pydantic v2, async endpoints,
  `'use client'` where needed, `@/*` alias, shadcn components.
- CI must stay at **zero lint warnings**.
- Branch naming: `sprint/NN-<slug>`; PR title `sprint(NN): <summary>`.

---

## 4. Remaining backlog (revised order)

The user explicitly reordered this: **Dependabot first**.

1. ~~**Dependabot remediation**~~ — done, Sprint 4; 210 → 1 accepted dev-only alert (§5.8)
2. ~~**Supabase migrations**~~ — done, Sprint 5 (§2); no longer implicit
3. **Phase 1 security** — admin auth, webhook HMAC, webhook idempotency —
   **immediate next**, and the `check-verification` auth bypass below comes first
4. **Real DB health probe**
5. **Small cleanups** — debug `console.log`s, stale remote branch

### 4a. Supabase migrations — delivered in Sprint 5
`supabase/migrations/20261103000000_init_casino_schema.sql` covers the five tables,
the three RPCs, the `user_profiles` view, indexes, RLS, and the deposit replay guard.
Open follow-ups, if the product needs them later:
- A real chain address generator (the wallet service still fabricates
  `{currency}_addr_<hex>` placeholders)
- Per-user JWT-scoped DB access instead of service-role-only, if the frontend ever
  talks to Supabase directly
- A migration runner in CI (the project is linked, but CI has no DB credentials;
  `scripts/validate-migration.sh` still validates against a throwaway Postgres)

### 4b. Phase 1 security (live gaps, deferred from Sprints 1–2)
- **`/api/auth/check-verification` is an auth bypass (NEW, found 2026-11-03)**:
  `backend/app/api/auth.py:136-160` looks up a user by email and, if the address is
  confirmed, returns an app JWT signed for that user id. Anyone who knows a verified
  user's email can obtain that user's token. It must verify a Supabase email-confirmation
  token (or be removed) before the security sprint ships anything else.
  `POST /auth/verify-email` is also a no-op that returns `success: True` for any token.
- **Admin auth absent**: `backend/app/api/admin.py:14,34` accept
  `authorization: str = Header(None)` and never use it; `post users/{user_id}/balance`
  is callable by anyone
- **Webhook HMAC not implemented**: `backend/app/api/webhooks.py:19-21` is a commented stub
- **Test webhook endpoints are public**: `/webhooks/test/deposit` lets anyone fabricate deposits
- **No idempotency**: the DB now has a unique partial index on deposit
  `metadata->>'tx_hash'`, but the app still races: two concurrent webhooks can both
  pass the pre-check, then one insert fails and is reported as `failed` rather than
  `skipped`. Handle the unique violation explicitly.
- Session hardening still deferred: tokens in `localStorage`
  (`frontend/lib/contexts/AuthContext.tsx`), no HttpOnly cookie / CSRF / refresh rotation

### 4c. Real health probe
`backend/app/api/casino.py:15-29` calls `db.client.auth.get_session()` and reports
`"connected"` whenever it doesn't throw — it never touches Postgres. Replace with a cheap
`SELECT` and return 503 on failure.

### 4d. Small cleanups
- `frontend/app/(main)/profile/page.tsx:135-136` — remove
  `console.log('Full user object:', …)` / `console.log('User ID:', …)`
- `git push origin --delete sprint/01-foundation`
- `/api/casino/state` returns hardcoded placeholder stats

---

## 5. Dependabot triage (executed 2026-11-03)

### 5.1 Method and source of truth
- Full snapshot: `/tmp/opencode/dependabot-open.json` (210 alerts)
- `npm audit --json` snapshot: `/tmp/opencode/npm-audit.json`
- **Both files are gone** — `/tmp/opencode` is wiped between sessions. Regenerate them with
  the two commands in §5.7 before re-triaging; the numbers in this section are the
  recorded result as of 2026-11-03.
- npm audit reports **32 unique vulnerable package nodes**; Dependabot reports **210 alert
  rows** because it counts each advisory × affected version. Always triage at the *package*
  level, not the alert level.
- 188 distinct GHSAs across the 210 alerts — many are the same fix.

### 5.2 Severity breakdown

| Severity | Alerts | Distinct advisories |
| --- | --- | --- |
| Critical | 7 | 6 |
| High | 88 | — |
| Moderate | 101 | — |
| Low | 14 | — |
| **Total** | **210** | **188** |

Ecosystem: **208 npm**, **2 pip**. Relationship: 76 npm direct, 132 npm transitive, 2 pip direct.

### 5.3 The headline finding

**128 of 210 alerts (61%) come from one devDependency: `shadcn@3.8.4`.** It is a CLI
(`bin: ./dist/index.js`), not a runtime import, and nothing in `app/`, `components/`, or
`lib/` imports it. Its dependency graph drags in:

```
shadcn → @modelcontextprotocol/sdk → hono / @hono/node-server / express
       → express-rate-limit → proxy-addr (CRITICAL)
       → body-parser / qs / path-to-regexp
       → ajv / fast-uri
       → deepmerge, postcss-selector-parser, zod (v3), ip-address, @hono/node-server
```

`proxy-addr` (critical) is the only critical reached this way.

**Removing `shadcn` from `devDependencies` and invoking it via `npx shadcn@latest`**
deletes that entire chain. This is the highest-leverage, lowest-risk move in the whole
triage and should be commit 1.

### 5.4 Buckets, ordered by execution

**Bucket A — runtime, fix immediately (≈77 alerts)**

| Package | Installed | Fix | Alerts (crit/high/med/low) |
| --- | --- | --- | --- |
| `next` | 16.1.6 | **16.4.4** | 38 (4/14/16/4) |
| `axios` | 1.13.5 | **≥1.20.0** | 34 (0/12/21/1) |
| `python-jose` | 3.5.0 | **no patch exists** → migrate to PyJWT | 2 (2/0/0/0) |

The 4 critical `next` findings are unauthenticated RCE in the Image Optimization API
(SVG and AVIF paths), RCE in `use cache` functions returning typed arrays, and an
RCE on Windows-hosted servers. Range is `>=16.0.0, <= 16.4.0`; patched at `16.4.1`
per Dependabot, `16.4.4` per npm audit. Bump to `16.4.4` — it also resolves the
`sharp` (3 high) and `postcss` findings that ride along with Next.

`python-jose` **has no fixed version** (`first_patched_version: NONE`, range `<= 3.5.0`);
GHSA-3qf3-8w2g-rqmx / CVE-2026-85394 is an algorithm-confusion guard bypass using
DER-encoded public keys. **PyJWT 2.15.1 is already installed** as a transitive dep.
Migration is small: `from jose import JWTError, jwt` → `import jwt` /
`from jwt import InvalidTokenError` in `backend/app/auth.py` (only file importing jose),
swap `JWTError` → `InvalidTokenError`, add explicit `PyJWT==2.15.1` to
`backend/requirements.txt`, remove `python-jose[cryptography]==3.5.0`.

**Bucket B — unused direct dependencies (10 alerts, zero risk)**

| Package | Declared | Used in source? | Action |
| --- | --- | --- | --- |
| `minimatch` | `^10.2.2` (prod!) | no | remove |
| `zod` | `^4.3.6` | no (`grep -rn zod app components lib` → 0) | remove |
| `shadcn` | `^3.8.4` (dev) | no | remove, use `npx` |

These look like earlier ad-hoc security pins. Removing them shrinks the alert surface and
the install size. Verify `npm run lint && npx tsc --noEmit && npm run build` afterwards —
zod is not used by `@hookform/resolvers` (its only peer is `react-hook-form`).

**Bucket C — dev toolchain refresh (the remaining ~120)**

After A and B, refresh the lint chain so it matches Next:
- `eslint-config-next` 16.1.6 → 16.4.4
- `eslint` ^9 → latest 9.x
- `typescript-eslint` / `@typescript-eslint/*` → latest
- Re-run `npm audit`; residual transitive items will be `brace-expansion`, `flatted`,
  `js-yaml`, `picomatch`, `@humanfs/node`, `@babel/core`, `ajv`,
  `baseline-browser-mapping`, `browserslist`, `nanoid`, `postcss-selector-parser`,
  `qs`, `source-map-js`, `follow-redirects`, `form-data`

Add narrow `overrides` in `frontend/package.json` **only for what remains after the
toolchain refresh**, not pre-emptively. Each override needs a one-line comment in the PR
body explaining why the parent cannot be bumped.

**Bucket D — accept / document**
Everything left must have a written justification and a review date. Expect the count to
be near zero if A–C land. `deepmerge` (low) disappears with `shadcn`.

### 5.5 Execution sequence (Sprint 4)

1. `git switch -c sprint/04-dependency-remediation` from clean `main`
2. Remove `shadcn`, `minimatch`, `zod`; confirm build → **commit**
3. `next@16.4.4`, `axios@^1.20.0`, `eslint-config-next@16.4.4` + lockfile → **commit**
4. Refresh eslint/typescript-eslint chain → **commit**
5. Targeted `overrides` for residuals → **commit**
6. Backend: PyJWT migration + requirements pin → **commit**
7. Run `./scripts/verify.sh` on Python 3.12 / Node 22 → **commit** any fixes
8. Open PR; Dependabot alerts **do not close until the fix is on the default branch** —
   expect them to remain open on the PR, then auto-close after merge

### 5.6 Risks
- `next` 16.1.6 → 16.4.4 is a minor bump but touches the build; 18 static pages and the
  Vercel preview must both be re-verified
- `axios` 1.13 → 1.20 is a minor bump; check `frontend/lib/api/client.ts` request/response
  interceptors still behave
- Removing `zod` is safe only because nothing imports it — re-verify with grep, not memory
- PyJWT and python-jose differ in exception type and in strictness around algorithms
  (always pass `algorithms=[...]`, which the code already does)
- Do **not** run `npm audit fix --force`; it will propose `shadcn@1.0.0` (a major) and
  churn unrelated packages

### 5.7 Regenerating the data (cheap, 2 commands)

```bash
mkdir -p /tmp/opencode
gh api "repos/OsaeAddo/crypto-casino/dependabot/alerts?state=open&per_page=100&sort=severity&direction=desc" \
  --paginate > /tmp/opencode/dependabot-open.json
(cd frontend && npm audit --json > /tmp/opencode/npm-audit.json || true)
python3 -c "import json;print(len(json.load(open('/tmp/opencode/dependabot-open.json'))),'alerts')"
```

210 alerts = 3 requests at `per_page=100`. Never call `/dependabot/alerts/{number}`.
Fetch once, then do all analysis offline against the cached JSON and
`frontend/package-lock.json`.

### 5.8 Residual Dependabot alert (accepted 2026-11-03)

After the Sprint 4 merge the count dropped **210 → 1**:

| Package | Version | Severity | Advisory | Path |
| --- | --- | --- | --- | --- |
| `minimatch` | 3.1.5 (6 nodes) | moderate | GHSA-g3hv-75wg-m249 | dev-only eslint chain |

`first_patched_version` is `11.0.1`; 3.x has no patch. The six nodes are pinned by
`eslint@9.39.5` and `eslint-config-next@16.4.4` plugins (`@eslint/config-array`,
`@eslint/eslintrc`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`,
`eslint-plugin-react`). Overriding 3.x → 11.x is a breaking API change (v3 exports a
function, v11 exports `{ minimatch }`) and would break the lint chain. The advisory is
a denial-of-service in glob expansion; no untrusted glob patterns reach it during lint
or build. **Review when `eslint@10` / `eslint-config-next` drop the 3.x pins.**

---

## 6. Next session: start here

```bash
cd <repo root>
git switch main && git pull --ff-only
git status -sb                    # expect clean; if dirty, stop and ask

git switch -c sprint/06-security
```

**Resume protocol (unchanged):** `git switch main && git pull --ff-only`; if Sprint 5 work is
already in progress, `git switch sprint/05-supabase-migrations` and read the §1 progress
checklist instead. Recreate the toolchain from §1 (Python 3.12 venv, Node 22) before running
`scripts/verify.sh`, and run `./scripts/validate-migration.sh` after touching SQL.

**Current next step:** Sprint 5 is **merged and applied to the live project**. The
adoption follow-up PR is open for review; a human merges it — do not merge it yourself.

After the adoption PR is merged:
1. Confirm CI on `main` is green.
2. Start Sprint 6 from §4b: **Phase 1 security**. Fix the
   `/api/auth/check-verification` token bypass first, then admin auth, webhook HMAC, and
   duplicate-race handling.
3. Optionally clear §4d small cleanups (debug `console.log`s in
   `frontend/app/(main)/profile/page.tsx`, delete stale `origin/sprint/01-foundation`).

Do **not** re-apply the baseline migration: `supabase_migrations.schema_migrations`
already records `20261103000000`, and the live tables hold the original demo data.

**Copy-paste resume prompt for the new session:**

> Read `AGENTS.md` and `docs/handoff-crypto-casino.md` in full, then follow the resume
> protocol: check `git log` / `git status`, recreate the CI-matching toolchain, and run
> `scripts/verify.sh`. Execute Sprint 6 (Phase 1 security) from §4b in commit-sized steps,
> starting with the `check-verification` auth bypass, updating §1 and §6 of the handoff at
> each commit boundary. Open a ready-for-review PR and stop.

`AGENTS.md` is auto-loaded by OpenCode, so the new agent should find that on its own. If it
is started in plan mode it can only read and plan; switch it to build mode to execute.

Also note: /tmp may be empty and local Node/Python are newer than CI, so the first run needs
the toolchain steps in §1. That part is not automatically reconstructed from this file.

---

## 7. Session quota playbook (OpenCode context / rate limits)

This is about **OpenCode session limits**, not the GitHub API. Failure mode from earlier
sessions: long silent work → limit hit → the thread and its context are lost mid-task.
Five habits prevent that. Follow them for every sprint.

1. **Checkpoint to git, not to chat.** One commit per completed item. Worst case a limit
   hit costs one commit; resumption is `git log` + the test suite. Never leave hours of
   work uncommitted while chasing a green build.
2. **One verification script instead of 8 round-trips.** Use `scripts/verify.sh` — it runs
   ruff, pytest, eslint, tsc, and build in one shot and tees logs to `/tmp/opencode`.
   Run it at commit boundaries, not after every edit.
3. **Handoff file at each milestone.** This document. Update §1 (state) and §6 (next step)
   at every commit boundary, or at minimum before anything long-running. On resume, point
   the agent at the path — a few hundred tokens instead of replaying the session. Note the
   deliberate deviation: the old pattern used `/tmp/opencode/handoff.md`, but `/tmp` is wiped
   between sessions, so the durable copy lives in the repo at
   `docs/handoff-crypto-casino.md` and is versioned with the code.
4. **Background long jobs, never poll.** `npm ci`, `next build`, `pip install`, and the
   full verify run can take tens of minutes. Fire them in the background, do other work,
   and read the log once at the end. Polling burns quota for nothing.
5. **Keep big artifacts out of the conversation.** Write diffs and logs to
   `/tmp/opencode/*.log`, then read a window. For source files, grep the symbol first and
   read ~40 lines around it rather than whole files.

Supporting habits:

- **Right-size the model.** Fast/cheap model for mechanical edits and renames; the stronger
  one for design, debugging, and triage. Subagents get fresh context but still draw from the
  same quota — use them for isolation, not as a quota loophole.
- **Batch independent calls in one block.** Parallel reads and greps, not serial round-trips.
- **Know the quota window.** If you are near the cap, stop at a commit boundary rather than
  mid-edit.
- **Trim noisy output at the source.** Remove debug `console.log`s (see §4d) so logs and
  verification output stay cheap.
- **Resume protocol:** read this file → `git log --oneline -5` → `git status -sb` →
  run `scripts/verify.sh` → continue from §6. Do not re-derive the backlog.

GitHub API hygiene is a minor sub-topic: one paginated sweep (§5.7), cache to
`/tmp/opencode`, never per-alert fetches, back off on 403/429 rather than retrying.
Dependabot alerts only close once the fix reaches the default branch, so re-check after merge.

---

## 8. Environment / tooling notes

- `/tmp/opencode` is ephemeral — **it was wiped between sessions**. Anything that must
  survive belongs in this doc or in the repo.
- `backend/.env` exists with `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SECRET_KEY`,
  `JWT_SECRET_KEY`, `FRONTEND_URL` only; all other settings use defaults. It is gitignored.
- `backend/.venv` is Python 3.14; `backend/.venv/bin/python -m ruff` works for quick
  checks but is not CI parity.
- `frontend/node_modules` was previously repaired with exact SWC / react-icons /
  lightningcss binaries. If `npm ci` is run, expect that repair to be needed again on a
  non-CI Node version.
- No real Supabase project is configured; auth/profile/bet tests use mocks and placeholders.
- Migration SQL is validated against **Postgres 18.3** (`postgres:18.3` Docker image). Supabase
  runs PG15+; the migration only uses features available since PG15 (`security_invoker`,
  `gen_random_uuid`, `jsonb_set`), but confirm on the project before the first prod apply.
- `backend/app/__pycache__` contains both `.cpython-312` and `.cpython-314` artifacts —
  harmless, gitignored.

---

## 9. Open decisions

- Exact `next` target: Dependabot requires `>=16.4.1`, npm audit recommends `16.4.4`.
  Default is `16.4.4`; change only if the Vercel preview regresses.
- Whether Phase 1 security is one sprint or split (admin auth + webhook signing could ship
  separately from session hardening). Recommend splitting: webhooks and the
  `check-verification` bypass are exploitable today; cookie migration is a larger frontend
  change.
- RLS posture: **decided in Sprint 5** — enabled deny-by-default, service-role-only API
  access, one address-scoped anon RPC. Revisit only if the frontend starts talking to
  Supabase directly; that would need per-user JWT policies on `casino_profiles`,
  `casino_bets`, `casino_transactions` and `casino_wallets`.
- Whether `/api/auth/check-verification` should require a Supabase confirmation token or be
  removed entirely in favour of the standard `/auth/verify` redirect flow. Product call,
  but it must stop minting tokens from an email lookup.
