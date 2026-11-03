# AGENTS.md

Instructions for AI agents working in this repository.

## Read this first

**Before planning or editing, read [`docs/handoff-crypto-casino.md`](docs/handoff-crypto-casino.md).**
It holds the current sprint state, the ordered backlog, and the active execution plan.

- `docs/handoff-crypto-casino.md` answers **"where are we?"**
- This file answers **"how do we work?"**

Update the handoff at every commit boundary (§1 current state, §6 next step). If you are
about to run anything long, or you are near a session limit, update it *before* starting.

## Project

A demo/play-money crypto casino. It does **not** handle real funds, real KYC, or real
withdrawals.

- `backend/` — FastAPI, Pydantic v2, Supabase Python SDK, PyJWT
- `frontend/` — Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui
- API prefix: `/api`; health check at `/api/casino/health`

## Verification

CI is the contract: **Python 3.12** and **Node 22**. Local versions may be newer — never
claim CI parity from a newer runtime, say which versions you actually ran.

```bash
# One shot: ruff + pytest + eslint + tsc + build, logs to /tmp/opencode
PYTHON=/path/to/venv/bin/python ./scripts/verify.sh

# Individually
cd backend  && ruff check app tests && pytest -q
cd frontend && npm run lint && npx tsc --noEmit && npm run build
```

`npm run lint` is `eslint . --max-warnings 0` — **any warning fails the gate**.

## Conventions

- `logging.getLogger(__name__)` per module; no `print()`
- Async endpoints throughout
- Pydantic v2 models
- `'use client'` only where genuinely needed
- `@/*` path alias; shadcn/ui components under `components/ui/`
- Do not add blanket lint ignores. Every `# noqa` needs an inline reason
  (e.g. `# noqa: BLE001 - API boundary: converts unexpected failures into HTTP errors`)
- Ruff version is pinned in `backend/requirements-dev.txt`; bump it deliberately

## Workflow

1. Branch from an up-to-date `main`: `sprint/NN-<slug>` (or `chore/<slug>` for docs/tooling)
2. One commit per logical item — never leave hours of work uncommitted
3. Open a **ready-for-review PR, then stop**. The human merges; do not merge it yourself
4. Never commit `.env` or secrets; only `.env.example` files are tracked
5. PR title: `sprint(NN): <summary>`; include evidence (commands run, results) in the body

## Session quota discipline

Long silent work followed by a limit hit is how context gets lost. Mitigate:

1. **Checkpoint to git, not chat.** Worst case a limit hit costs one commit.
2. **One `scripts/verify.sh` run, not eight round-trips.** Run it at commit boundaries.
3. **Update the handoff at each milestone** so resumption costs a few hundred tokens.
4. **Background long jobs, never poll.** `npm ci`, `next build`, `pip install` — fire and
   read the log once when done.
5. **Keep big artifacts out of the conversation.** Write diffs/logs to `/tmp/opencode/` and
   read a window; grep for a symbol, then read ~40 lines around it.

Also: batch independent tool calls in one block, right-size the model (cheap for mechanical
edits, stronger for design/debug), and stop at a commit boundary when near the cap.

## Continuing in a new session

Start the new session with:

> Read `AGENTS.md` and `docs/handoff-crypto-casino.md`, then follow the resume protocol:
> check `git log` / `git status`, recreate the CI toolchain if needed, run
> `scripts/verify.sh`, and continue from §6 of the handoff.

The handoff does **not** capture environment state. `/tmp` is wiped between sessions and
local Node/Python versions may be newer than CI, so verify the toolchain first.

When you finish an item, update the handoff's §1 and §6 and commit the doc alongside the
code. Keeping it current is part of the definition of done.
