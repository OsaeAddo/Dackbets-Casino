# Manual QA runbook — pre-Sprint 13

Status: **automated pass complete 2026-11-08; awaiting physical-phone confirmation**
Scope: every feature and fix merged through Sprint 12 (`main` @ `d627791`).
Freeze: no sprint branches, no application code changes, no Sprint 13 work until this
pass is signed off.

This is a **demo / play-money** build. No real funds, KYC, or withdrawals are involved.

## Verdict (automated pass)

- Pass 1 (localhost desktop): every functional check passed; the only failures were the
  dev-only console warnings F-2/F-3.
- Pass 2 (LAN origin, Pixel 5 profile): 11/12, only the F-2 warning.
- `npm run build` clean, `npm run test:e2e` 5/5, production-build behaviour re-checked.
- **One real defect: F-1** — `GET /api/admin/stats` always reports `total_balance` as 0.
- **No Sprint 12 regression.** The credential-in-URL path is closed on localhost and on
  the LAN origin, including with the client bundle blocked.
- Still to do: confirm on a physical phone and complete §7 teardown.

---

## 1. Environment

### 1.1 Local (gitignored) overrides

`backend/.env` — appended, remove after QA:

```dotenv
COOKIE_SECURE=false                 # plain HTTP; required for phone/LAN
ENABLE_TEST_WEBHOOKS=true           # exposes POST /api/webhooks/test/deposit
REQUIRE_KYC_FOR_WITHDRAWAL=false    # lets withdrawals through the stub KYC gate
FRONTEND_URLS=http://127.0.0.1:3000,http://172.20.10.4:3000
```

`frontend/.env.local` — created for Pass 1:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Pass 2 (phone/LAN) replaces the two lines above with:

```dotenv
NEXT_PUBLIC_API_URL=http://172.20.10.4:8000/api
ALLOWED_DEV_ORIGINS=172.20.10.4
```

### 1.2 Start / stop

```bash
# backend (binds all interfaces so the phone can reach it)
cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000

# frontend
cd frontend && npm run dev -- -H 0.0.0.0
```

Logs for the automated session: `/tmp/opencode/backend.log`, `/tmp/opencode/frontend.log`.

Open **`http://localhost:3000`** (not `127.0.0.1:3000`) for Pass 1. The `127.0.0.1`
origin is in `FRONTEND_URLS` only as a convenience; cookies and CORS behave as designed
for `localhost`.

### 1.3 QA account

Created through the public signup endpoint and funded with the admin endpoint. Credentials
live in `/tmp/opencode/qa-credentials.txt` and are **not** committed.

```bash
set -a; . backend/.env; set +a

# create (auto-confirm is on for the live project, so no email step)
curl -s -X POST http://localhost:8000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"qa+20261108@example.com","password":"<see credentials file>","username":"qa-tester"}'

# fund
curl -s -X POST "http://localhost:8000/api/admin/users/630e1213-23b5-48ba-b4fa-1051549a349f/balance" \
  -H "X-Admin-Key: $ADMIN_API_KEY" -H 'Content-Type: application/json' \
  -d '{"ETH":10,"BTC":1,"USDT":10000}'
```

### 1.4 Pre-flight results

| Check | Result |
| --- | --- |
| Live Supabase reachable | pass (`casino_house_stats` readable via service role) |
| `mailer_autoconfirm` | `true` — signup returns a session immediately |
| `GET /api/casino/health` | `200`, `database: connected`, `casino_open: true` |
| `GET /api/games/limits` | ETH 0.001–100, BTC 0.0001–10, USDT 10–100000 |
| CORS `localhost:3000` | `access-control-allow-origin: http://localhost:3000` |
| `cookie_secure` / `enable_test_webhooks` / `require_kyc_for_withdrawal` | `false` / `true` / `false` |
| Local runtimes | Python 3.14.9, Node 26.13.0 (CI contract: 3.12 / 22 — not parity) |

---

## 2. Pass 1 — desktop on localhost

Legend: `P` pass, `F` fail, `N/A` not applicable, `GAP` known gap (see §5).

### A. Public pages and baseline

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| A1 | `/` loads | hero + game cards, no console errors | |
| A2 | `/games` loads | dice playable, others “Coming soon” | |
| A3 | `/games/dice` loads logged out | page renders, prompts sign-in on bet | |
| A4 | `/login`, `/register` load | forms render, no console errors | |
| A5 | Non-dice games not clickable | no navigation / disabled CTA | |
| A6 | `GET /api/casino/health` | 200, `database: connected` | |
| A7 | `GET /api/casino/state` | real players/wagered/biggest wins, no placeholders | |
| A8 | `GET /api/games/limits` | per-currency min/max from settings | |

### B. Auth and sessions

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| B1 | Sign up a new email | 201, immediate session, redirect to `/dashboard` | |
| B2 | Duplicate sign-up | error (“Email already registered” — enumeration is Sprint 13) | GAP |
| B3 | Wrong password | 401 generic “Invalid credentials” | |
| B4 | Correct password | session + dashboard | |
| B5 | `/dashboard` while logged out | redirect to `/login`; after login, dashboard | |
| B6 | Log out | auth cookies cleared, dashboard redirects, Back does not restore session | |
| B7 | Delete `casino_access`, reload | silent refresh, `casino_refresh` value rotates | |
| B8 | Cookie flags | `casino_access` HttpOnly; `casino_refresh` HttpOnly + path `/api/auth`; `casino_csrf` readable; `casino_session` readable | |
| B9 | `localStorage` | contains no tokens | |
| B10 | `POST /api/auth/check-verification` | 404 (bypass removed) | |
| B11 | `GET /api/auth/me` without cookie | 401 | |
| B12 | CSRF: unsafe request with session cookie but no `X-CSRF-Token` | 403 | |
| B13 | Refresh token replay (reuse an old refresh token) | 401 and session family revoked | |

### C. Sprint 12 regression (primary reason for this pass)

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| C1 | Credential inputs have no `name` attribute | `input[name=email]` / `[name=password]` absent | |
| C2 | Form is `method="post"` | `<form method="post">` | |
| C3 | JavaScript disabled | submit button disabled, no native GET with credentials | |
| C4 | Block `**/_next/static/**`, submit form | URL stays `/register` / `/login`; request is POST, never `?email=…&password=…` | |
| C5 | `_next` chunk requests | 200 direct, never 307/302 to `/login` | |
| C6 | Submit after hydration | button enables, login works | |
| C7 | `npm run test:e2e` | 5/5 pass | |

### D. Wallet, deposits, withdrawals

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| D1 | `/wallet` | ETH/BTC/USDT balances, addresses, copy buttons | |
| D2 | Address formats | BTC `1`/`3`/`bc1`, ETH `0x`+40 hex, USDT EVM-style; no `_addr_` placeholders | |
| D3 | `/wallet/deposit` | creates request, address + QR + 24h expiry | |
| D4 | QR image | loads from `api.qrserver.com` (external dependency) | |
| D5 | `/wallet/history` | pending deposit row visible | |
| D6 | Test webhook deposit | `confirmed`, balance increases, history row appears | |
| D7 | Replay same `tx_hash` | `skipped`/already processed, balance unchanged | |
| D8 | Tatum webhook unsigned / bad signature | 401 | |
| D9 | Tatum webhook valid HMAC | 200 `processing` | |
| D10 | Test webhook without admin key | 403 | |
| D11 | Test webhook with `ENABLE_TEST_WEBHOOKS=false` | 404 | |
| D12 | Withdrawal invalid address | 400 | |
| D13 | Withdrawal above balance | 400 | |
| D14 | Valid withdrawal | pending row, balance deducted | |
| D15 | Withdrawal with KYC gate on (default) | 403 “KYC verification required” | GAP |

### E. Games and stats

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| E1 | `/games/dice` limits + balance | loaded from API | |
| E2 | Currency switch | stake resets to that currency's minimum | |
| E3 | Below min / above max / above balance | clear rejection, no balance change | |
| E4 | Valid bet | roll/target/multiplier shown, balance updates, toast, history refreshes | |
| E5 | `GET /api/games/history` | contains the bet | |
| E6 | `/profile` stats | bet count/wagered/won updated | |
| E7 | `GET /api/casino/state`, `GET /api/admin/stats` | totals move after a bet | |
| E8 | Non-dice bet via API | 501 | |

### F. Profile and simulated flows

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| F1 | `/profile` | real bet stats + recent activity | |
| F2 | `/profile/settings` save | toast only (simulated) | GAP |
| F3 | `/profile/security` password/2FA | toast only (simulated) | GAP |
| F4 | `/forgot-password` | success screen only (simulated) | GAP |

### G. Admin and security probes

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| G1 | `GET /api/admin/stats` no key / wrong key | 403 | |
| G2 | `GET /api/admin/stats` correct key | 200 real stats | |
| G3 | `POST /api/admin/users/{id}/balance` no key | 403 | |
| G4 | `POST /api/admin/users/{id}/balance` correct key | balance changes | |
| G5 | Anon key against `/rest/v1/casino_profiles` | denied / empty (RLS) | |
| G6 | CORS allowed origin | `access-control-allow-origin` present | |
| G7 | CORS disallowed origin | header absent | |
| G8 | Security headers | absent — Sprint 13 item | GAP |
| G9 | Rate limiting | absent — Sprint 13 item | GAP |

---

## 3. Pass 2 — phone on LAN (`http://172.20.10.4:3000`)

Same checklist items, focused on the origin where the Sprint 12 leak appeared.
Restart both servers after changing `frontend/.env.local`.

| # | Check | Expected | Result |
| --- | --- | --- | --- |
| P1 | Page loads on phone over LAN | React hydrates (needs `ALLOWED_DEV_ORIGINS`) | |
| P2 | Login submit button enables | not stuck disabled | |
| P3 | Login works | session cookies set on the LAN origin | |
| P4 | No credentials in URL after submit | URL unchanged, POST only | |
| P5 | Block `_next/static`, submit | still no GET with credentials | |
| P6 | `_next` chunks | 200, not redirected to `/login` | |
| P7 | Dashboard + wallet load | balances render | |
| P8 | Dice bet on phone | bet accepted, balance updates | |
| P9 | Logout on phone | cookies cleared, redirect | |

---

## 4. API / security probe commands

Run with `set -a; . backend/.env; set +a` and `JAR=/tmp/opencode/qa-cookies.txt`.

```bash
# --- admin key gate
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/admin/stats
curl -s -o /dev/null -w '%{http_code}\n' -H 'X-Admin-Key: wrong' http://localhost:8000/api/admin/stats
curl -s -H "X-Admin-Key: $ADMIN_API_KEY" http://localhost:8000/api/admin/stats

# --- unauthenticated
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/auth/me
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/auth/check-verification

# --- CSRF (session cookie, no header)
curl -s -b "$JAR" -o /dev/null -w '%{http_code}\n' -X POST \
  http://localhost:8000/api/wallet/withdraw \
  -H 'Content-Type: application/json' -d '{"currency":"ETH","amount":0.01,"address":"0x0000000000000000000000000000000000000000"}'

# --- webhooks
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/webhooks/tatum/deposit \
  -H 'Content-Type: application/json' -d '{"tx_hash":"x","currency":"ETH","amount":1,"address":"0x0"}'
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/webhooks/test/deposit \
  -H 'Content-Type: application/json' -d '{}'

# --- RLS (anon key cannot read casino tables)
curl -s -o /dev/null -w '%{http_code}\n' \
  "$SUPABASE_URL/rest/v1/casino_profiles?select=user_id&limit=1" \
  -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY"
```

---

## 5. Known gaps — not regressions

- Only **Dice** is playable; slots/blackjack/roulette are “Coming soon”.
- Forgot password, profile settings, security/2FA and KYC are simulated or stubs.
- No user-facing demo funding; the admin endpoint is the only top-up.
- Email verification is not exercised: live project has `mailer_autoconfirm=true`.
- Deposit history shows a pending row **plus** a confirmed webhook row by design.
- QR codes depend on `api.qrserver.com`.
- Signup errors enumerate accounts, emails are logged, no rate limits and no security
  headers — Sprint 13 scope, currently frozen.
- Webhook amounts are not validated for NaN/inf — Sprint 14 scope.

---

## 6. Results

Filled in as the pass runs. Failures record: step, expected, actual, evidence
(screenshot / network capture), backend log excerpt.

### Pass 1

Automated on 2026-11-08 against `http://localhost:3000` + `http://localhost:8000`,
Chromium via Playwright, plus curl probes. Logs: `/tmp/opencode/{probes1,probes2,probes3,probes4,ui-check2}.out`.

#### A. Public pages and baseline

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| A1 | `/` loads, no console errors | P | 200, no errors |
| A2 | `/games` loads | P | 200, 6 “Coming soon” cards |
| A3 | `/games/dice` loads logged out | P | 200; renders; 401s from authenticated history call only (see F-4) |
| A4 | `/login`, `/register` load | P | 200, no console errors |
| A5 | Non-dice games not clickable | P | no navigation from slots/blackjack/roulette |
| A6 | `GET /api/casino/health` | P | 200 `database: connected` |
| A7 | `GET /api/casino/state` | P | real players/wagered/biggest wins |
| A8 | `GET /api/games/limits` | P | per-currency min/max from settings |

#### B. Auth and sessions

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| B1 | Sign up new email | P | 201, session cookies set immediately |
| B2 | Duplicate sign-up | P (GAP) | 400 “Email already registered” — enumeration is Sprint 13 |
| B3 | Wrong password | P | 401 “Invalid credentials” |
| B4 | Correct password | P | 200 + dashboard |
| B5 | `/dashboard` logged out → `/login` | P | redirect verified |
| B6 | Log out | P | 200, all `casino_*` cookies cleared, dashboard redirects, back button does not restore |
| B7 | Delete `casino_access`, reload | P | silent refresh, `casino_refresh` rotates (API probe: `rotated=yes`) |
| B8 | Cookie flags | P | access HttpOnly; refresh HttpOnly + path `/api/auth`; csrf/session readable; all `Secure=false` over HTTP |
| B9 | `localStorage` | P | no tokens |
| B10 | `POST /api/auth/check-verification` | P | 404 |
| B11 | `GET /api/auth/me` without cookie | P | 401 |
| B12 | Unsafe request without `X-CSRF-Token` | P | 403 “CSRF token missing or invalid” |
| B13 | Refresh token replay | P | 401 “Session expired”; family revoked, access cookie also invalidated |

#### C. Sprint 12 regression

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| C1 | No `name` on credential inputs | P | `names=[]` on both forms |
| C2 | Form `method="post"` | P | `method=post` |
| C3 | JavaScript disabled | P | submit disabled; no native GET |
| C4 | Blocked client bundle + forced submit | P | URL unchanged, POST only (e2e) |
| C5 | `_next` assets not redirected | P | no 3xx on `/_next/*` (only 304 revalidations) |
| C6 | Submit enables after hydration | P | enabled on both forms |
| C7 | `npm run test:e2e` | P | 5/5 passed (6.9 s) on the production build |

#### D. Wallet, deposits, withdrawals

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| D1 | `/wallet` balances + addresses | P | 3 wallets, total USD card, copy buttons |
| D2 | Address formats | P | ETH `0x9840…7003`, BTC `1N9u…VqL`, USDT `0x066f…4803` |
| D3 | `/wallet/deposit` | P | address, QR, expiry shown |
| D4 | QR | P | `api.qrserver.com` URL |
| D5 | History pending row | P | pending deposit visible |
| D6 | Test webhook deposit | P | `confirmed`, +0.5 ETH |
| D7 | Replay `tx_hash` | P | `skipped` / `already_processed`, balance unchanged |
| D8 | Tatum unsigned / bad signature | P | 401 both |
| D9 | Tatum valid HMAC | P | 200 `processing`, +0.25 ETH |
| D10 | Test webhook without admin key | P | 403 |
| D11 | Test webhook with flag off | P | 404 (verified after restart, §6) |
| D12 | Withdrawal invalid address | P | client-side “Invalid ETH address format”; API 400 |
| D13 | Withdrawal above balance | P | 400 “Insufficient balance” |
| D14 | Valid withdrawal | P | 200 pending, balance −0.01 ETH |
| D15 | KYC gate on | not run | gate disabled for this pass; stub behaviour covered by code |

#### E. Games and stats

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| E1 | Dice limits + balance | P | rendered from API |
| E2 | Currency switch resets stake | P | switch ETH→BTC resets to BTC minimum |
| E3 | Limit rejections | P | below min, above max, above balance, win_chance 0/101 all 400 |
| E4 | Valid bet | P | roll/target/multiplier, toast, balance, history refresh |
| E5 | `GET /api/games/history` | P | bet present |
| E6 | `/profile` stats | P | totalBets/wagered/won update |
| E7 | Casino state + admin stats totals | P | daily volume moved after bets |
| E8 | Non-dice bet | P | 501 |

#### F. Profile and simulated flows

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| F1 | `/profile` real stats | P | bet count, wagered, activity |
| F2 | `/profile/settings` | P (GAP) | renders; save is simulated |
| F3 | `/profile/security` | P (GAP) | renders; password/2FA simulated |
| F4 | `/forgot-password` | P (GAP) | renders; success screen only |

#### G. Admin and security probes

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| G1 | Admin stats no/wrong key | P | 403 both |
| G2 | Admin stats correct key | P | 200 (see F-1 for `total_balance`) |
| G3 | Admin balance no key | P | 403 |
| G4 | Admin balance correct key | P | 200, balance applied |
| G5 | Anon key vs casino tables | P | `42501 permission denied` |
| G6 | CORS allowed origins | P | `localhost`, `127.0.0.1`, LAN host echoed |
| G7 | CORS disallowed origin | P | no `access-control-allow-origin` |
| G8 | Security headers | GAP | absent — Sprint 13 |
| G9 | Rate limiting | GAP | absent — Sprint 13 |

#### Findings

| ID | Severity | Finding |
| --- | --- | --- |
| F-1 | **Bug (Sprint 10)** | `GET /api/admin/stats` reports `total_balance` as all zeros. `build_admin_stats` sums `casino_wallets.balance`, but nothing ever writes that column — balances live in `casino_profiles.balance` (RPC `update_user_balance`). Verified with a funded account holding 10.7 ETH / 1 BTC / 10 000 USDT while admin stats returned `{ETH:0, BTC:0, USDT:0}`. Fix: aggregate `casino_profiles.balance` (or drop the vestigial wallet balance column). |
| F-2 | Minor (dev-only) | `/wallet` passes `cursor-pointer` as a prop to `<Button>`, which React forwards to the DOM: `Received true for a non-boolean attribute cursor-pointer`. Warning appears in dev only; production renders fine. Replace with the `cursor-pointer` class. |
| F-3 | Minor (dev-only) | `/wallet/history` appends every fetch to existing state (`setTransactions(prev => [...prev, ...data])`) without de-duplicating. Under React StrictMode the mount effect runs twice, so every row renders twice with duplicate React keys. Production build renders each row once; still worth de-duplicating by `id`. |
| F-4 | Minor | Visiting `/games/dice` and `/wallet` while logged out triggers authenticated fetches (`/games/history`, `/auth/me`) that log 401/403 console noise. Pages recover; no user-facing error. |
| F-5 | External | `api.coingecko.com` is called directly from the browser and is CORS-blocked from this origin, logging errors and intermittently leaving USD values at 0. Same class of dependency as the QR service; a server-side proxy or fallback rates would remove it. |

### Pass 2

Emulated with Playwright's Pixel 5 profile against `http://172.20.10.4:3000` (the real LAN
origin, same server), 2026-11-08. Log: `/tmp/opencode/lan-check.out`.
A first attempt failed because an old production server still held port 3000 and the dev
server had fallen back to 3001 with the Pass 1 API URL; after a clean restart all checks
below passed. Not an application defect.

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| P1 | Page loads over LAN and hydrates | P | submit enabled without touching DevTools |
| P2 | Login submit enables | P | hydration guard opens on the LAN origin |
| P3 | Login works | P | dashboard reached, 4 cookies on `172.20.10.4` |
| P4 | No credentials in URL | P | URL `/dashboard`; all navigation requests clean |
| P5 | Blocked `_next/static` + forced submit | P | URL stays `/login`, no `?email=`/`?password=` |
| P6 | `_next` chunks | P | served 200 from the allowed dev origin |
| P7 | Dashboard + wallet | P | ETH/BTC/USDT balances render on the phone viewport |
| P8 | Dice bet | P | `Roll: 6.17`, balance updated |
| P9 | Logout | P | 200, all `casino_*` cookies cleared |
| P10 | Cookies scoped to LAN host | P | none leaked to `localhost` |

### Production build checks

`npm run build` succeeded; a `next start` run on port 3000 confirmed behaviour that differs
between dev and production. Log: `/tmp/opencode/prod-check.out`.

| Check | Result | Evidence |
| --- | --- | --- |
| Production login | P | dashboard reached |
| `/wallet/history` duplicate rows | P (dev-only) | 0 duplicate-key warnings in prod; duplicates only under React StrictMode in dev (F-3) |
| `cursor-pointer` prop warning | dev-only | 0 warnings in prod; invalid attribute is still forwarded (F-2) |
| Silent refresh after losing `casino_access` | P | stays on dashboard, `casino_refresh` rotates |
| Currency switch resets stake | P | ETH 0.01 → BTC 0.0001 |


---

## 7. Teardown

1. Remove the QA overrides from `backend/.env` (keep `COOKIE_SECURE=false` only if you
   still develop over plain HTTP).
2. Delete `frontend/.env.local` or restore the pre-QA value.
3. Decide whether to delete the `qa+20261108@example.com` user (profile, wallets, bets,
   sessions) or leave it as demo data.
4. Stop both dev servers.
5. Rotate the `TestPass1!` password noted in the Sprint 11 review, if not already done.
6. Update `docs/handoff-crypto-casino.md` §1/§6 and unfreeze Sprint 13 only after the
   results above are signed off.
