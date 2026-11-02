# Crypto Casino

A demo/play-money crypto casino built with FastAPI, Supabase, and Next.js. This
project does **not** handle real funds, real KYC, or real withdrawals yet.

## Stack

- **Backend:** FastAPI, Pydantic v2, Supabase Python SDK, python-jose
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

### Supabase objects used by the API

The current code expects these tables/RPCs to exist in Supabase:

- `casino_profiles`, `casino_wallets`, `casino_transactions`, `casino_bets`
- `update_user_balance` and `update_house_stats` RPCs
- A `user_profiles` view used by the email-verification check

There are no migrations in the repository yet; see the Sprint 3 roadmap item for
schema/ledger work.

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
- Session hardening (HttpOnly cookies, CSRF, refresh rotation) is planned for a
  later sprint; the current frontend stores tokens in `localStorage`.

## Sprint workflow

Sprint branches are created from `main` (for example, `sprint/01-foundation`).
Do not push WIP checkpoint commits or open a pull request until the sprint review
packet has been approved.
