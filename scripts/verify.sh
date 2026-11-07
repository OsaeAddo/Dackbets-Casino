#!/usr/bin/env bash
# Run the same checks as CI. Requires backend deps installed and frontend node_modules.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${VERIFY_LOG_DIR:-/tmp/opencode}"
PYTHON="${PYTHON:-python}"

mkdir -p "$LOG_DIR"

run() {
  local name="$1"
  shift
  echo "==> $name"
  "$@" 2>&1 | tee "$LOG_DIR/verify-${name// /-}.log"
}

run "backend ruff" bash -c "cd '$ROOT/backend' && '$PYTHON' -m ruff check app tests"
run "backend pytest" bash -c "cd '$ROOT/backend' && '$PYTHON' -m pytest -q"
run "frontend eslint" bash -c "cd '$ROOT/frontend' && npm run lint"
run "frontend tsc" bash -c "cd '$ROOT/frontend' && npx tsc --noEmit"
run "frontend build" bash -c "cd '$ROOT/frontend' && npm run build"
run "frontend e2e" bash -c "cd '$ROOT/frontend' && npm run test:e2e"

echo "==> All checks passed"
