# Handoff — crypto-casino

Prepared: 2026-11-03
Repo: `OsaeAddo/crypto-casino`
Remote: `git@github.com:OsaeAddo/crypto-casino.git`

This file is versioned with the code and is the authoritative copy. Agent working rules
live in [`AGENTS.md`](../AGENTS.md).

This document is the entry point for a **new session in the same workspace**. Read
sections 1–3 before touching anything. Section 6 is the immediate work order.

---

## 1. Current state (verified 2026-11-03)

| Item | Value |
| --- | --- |
| Branch | `sprint/04-dependency-remediation` (Sprint 4 in progress) |
| HEAD | see `git log --oneline -1` on the sprint branch |
| Sync | branched from `main` @ `3912f19` (merge PR #4, handoff docs) |
| Working tree | **clean** — the README warning-line removal was reverted by the user |
| CI on `main` | success — run 41466303130 (CI), 41466311701 (Dependency Graph) |
| Open PRs | none |
| Dependabot | **210 open** — 7 critical / 88 high / 101 moderate / 14 low |
| Migrations | **none** — no `supabase/` or `migrations/` directory exists |
| Stale remote branch | `origin/sprint/01-foundation` still exists (merged, never deleted) |
| Secrets | `backend/.env` is gitignored (`git check-ignore` confirms); `frontend/.env.local` ignored |

### Sprint 4 progress (`sprint/04-dependency-remediation`)

Verified on CI-matching runtimes this session: Python **3.12.13** (`/tmp/opencode/venv312`)
and Node **22.20.0** (`/tmp/opencode/node-v22.20.0-linux-x64`). Baseline `verify.sh` was
green before any change.

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
- [ ] §5.5.6 PyJWT migration (code + requirements edited, not yet committed)
- [ ] §5.5.7 final `verify.sh` + PR

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

### Delivered artifacts that still exist
- Git history and the two PRs above (the review packets in `/tmp/opencode` are gone)
- `README.md`, `.github/workflows/ci.yml`, `scripts/verify.sh`, `backend/pyproject.toml`,
  `backend/requirements-dev.txt`, `frontend/package.json`

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

1. **Dependabot remediation** — Section 5 below (immediate)
2. **Supabase migrations** — schema is implicit and unreproducible
3. **Phase 1 security** — admin auth, webhook HMAC, webhook idempotency
4. **Real DB health probe**
5. **Small cleanups** — debug `console.log`s, stale remote branch

### 4a. Supabase migrations (after Dependabot)
No schema lives in the repo. Needs:
- `supabase/migrations/<ts>_init_casino_schema.sql` for `casino_profiles`,
  `casino_wallets`, `casino_transactions`, `casino_bets`
- RPCs `update_user_balance`, `update_house_stats` matching current Python call signatures
- `user_profiles` view used by the email-verification check
- Indexes for wallet-by-user+currency, bets-by-user, transactions-by-hash
- RLS policy decision (everything currently uses the service-role client)
- README "Supabase objects used by the API" updated (it currently says "no migrations yet")

### 4b. Phase 1 security (live gaps, deferred from Sprints 1–2)
- **Admin auth absent**: `backend/app/api/admin.py:14,34` accept
  `authorization: str = Header(None)` and never use it; `post users/{user_id}/balance`
  is callable by anyone
- **Webhook HMAC not implemented**: `backend/app/api/webhooks.py:19-21` is a commented stub
- **Test webhook endpoints are public**: `/webhooks/test/deposit` lets anyone fabricate deposits
- **No idempotency**: zero `idempot` matches in `backend/app`; replaying a `txId` can double-credit
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

---

## 6. Next session: start here

```bash
cd <repo root>
git switch main && git pull --ff-only
git status -sb                    # expect clean; if dirty, stop and ask

git switch -c sprint/04-dependency-remediation
```

Then execute §5.5 in order. Stop after the PR is ready for review.

**Resume protocol (unchanged):** `git switch main && git pull --ff-only`; if Sprint 4 work is
already in progress, `git switch sprint/04-dependency-remediation` and read the §1 progress
checklist instead. Recreate the toolchain from §1 (Python 3.12 venv, Node 22) before running
`scripts/verify.sh`.

**Current next step:** §5.5.6 — commit the PyJWT migration (already applied in the working
tree), then §5.5.7 final verify + PR.

**Copy-paste resume prompt for the new session:**

> Read `AGENTS.md` and `docs/handoff-crypto-casino.md` in full, then follow the resume
> protocol: check `git log` / `git status`, recreate the CI-matching toolchain, and run
> `scripts/verify.sh`. Execute Sprint 4 (Dependabot remediation) per §5.5 in commit-sized
> steps, updating §1 and §6 of the handoff at each commit boundary. Open a
> ready-for-review PR and stop.

`AGENTS.md` is auto-loaded by OpenCode, so the new agent should find that on its own. If it
is started in plan mode it can only read and plan; switch it to build mode to execute.

Also note: /tmp is empty and local Node/Python are newer than CI, so the first run needs
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
- `backend/app/__pycache__` contains both `.cpython-312` and `.cpython-314` artifacts —
  harmless, gitignored.

---

## 9. Open decisions

- Exact `next` target: Dependabot requires `>=16.4.1`, npm audit recommends `16.4.4`.
  Default is `16.4.4`; change only if the Vercel preview regresses.
- Whether Phase 1 security is one sprint or split (admin auth + webhook signing could ship
  separately from session hardening). Recommend splitting: webhooks are exploitable today,
  cookie migration is a larger frontend change.
- RLS policy posture for the Supabase migration sprint — service-role-only today, so any
  RLS is a product decision, not a mechanical one.
