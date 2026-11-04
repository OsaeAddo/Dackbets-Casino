# Crypto Casino

A demo/play-money crypto casino built with FastAPI, Supabase, and Next.js. This
project does **not** handle real funds, real KYC, or real withdrawals yet.

## Stack

- **Backend:** FastAPI, Pydantic v2, Supabase Python SDK, PyJWT
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4, shadcn/ui
- **Database/Auth:** Supabase (Postgres + Auth)

## Repository layout

```text
backend/    FastAPI application (API prefix: /api)
frontend/   Next.js application
```

## Prerequisites

- Python 3.11+ (verified on Python 3.14)
- Node.js 20.9+ and npm
- A Supabase project (or placeholder credentials for a boot-only smoke test)

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Supabase project values.
uvicorn app.main:app --reload --port 8000
```

- API base URL: <http://localhost:8000/api>
- Interactive docs: <http://localhost:8000/docs>
- Health check: <http://localhost:8000/api/casino/health>

### Required environment variables (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/public key |
| `SUPABASE_SECRET_KEY` | Supabase service-role key (server-side only) |
| `JWT_SECRET_KEY` | Secret used to sign the app's derived JWTs |
| `FRONTEND_URL` | Primary CORS origin (default `http://localhost:3000`) |
| `FRONTEND_URLS` | Optional comma-separated extra CORS origins |

Never commit `backend/.env`. The committed template is `backend/.env.example`.

### Supabase schema

The schema is versioned in [`supabase/migrations/`](supabase/migrations). Apply it with
the Supabase CLI, or by pasting the `.sql` file into the project's SQL editor.

```bash
supabase link --project-ref <ref>       # once; requires `supabase login`
export SUPABASE_DB_PASSWORD='...'       # Dashboard → Settings → Database
supabase db push --remote               # the local Docker stack is the default target
```

`--remote` is required: without it the CLI targets the local stack at `127.0.0.1:54322`.
Supplying the database password (`SUPABASE_DB_PASSWORD` or `-p`) also skips the CLI's
temporary `cli_login_postgres` role, which some projects reject with
`permission denied to alter role`.

Projects that already have the tables (created by hand before migrations existed) need a
one-time adoption. The project was adopted on 2026-11-04 with
[`supabase/adoption/20261104_detach_legacy_schema.sql`](supabase/adoption/20261104_detach_legacy_schema.sql):
move the old tables into `legacy_20261104`, push the baseline, copy the rows back, verify
counts, then `drop schema legacy_20261104 cascade`.

Objects used by the API:

- Tables: `casino_profiles`, `casino_wallets`, `casino_transactions`, `casino_bets`,
  `casino_house_stats`
- RPCs: `update_user_balance`, `update_house_stats`, `get_user_by_email`
- View: `user_profiles` (service-role only)

RLS is enabled on every table and denies `anon`/`authenticated`, so the API must use
`SUPABASE_SECRET_KEY`. The one anon-callable object is `get_user_by_email`, which
returns at most the row matching the supplied address.

To apply the migrations and run the SQL contract tests against a throwaway Postgres:

```bash
./scripts/validate-migration.sh
```

## Frontend setup

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

### Frontend environment variables (`frontend/.env.local`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend API base URL, e.g. `http://localhost:8000/api` |

`NEXT_PUBLIC_*` variables are visible in the browser. Do not put secrets there.

## Tests and checks

```bash
# Backend (from backend/)
pip install -r requirements.txt -r requirements-dev.txt
ruff check app tests
pytest

# Frontend (from frontend/)
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

`npm run lint` fails on any warning. To run the full CI suite locally in one
shot:

```bash
PYTHON=/path/to/backend/.venv/bin/python ./scripts/verify.sh
```

GitHub Actions runs the same checks on every push to `main` and every pull
request (Python 3.12 and Node 22); see `.github/workflows/ci.yml`.

## Demo-only constraints

- No real deposits or withdrawals are processed.
- Crypto provider integration is testnet/mock only.
- Withdrawals are disabled or stubbed.
- Sessions use HttpOnly access/refresh cookies with double-submit CSRF and rotating
  refresh tokens; the frontend keeps no auth tokens in `localStorage`.

## Sprint workflow

Sprint branches are created from `main` (for example, `sprint/01-foundation`).
Do not push WIP checkpoint commits or open a pull request until the sprint review
packet has been approved.
