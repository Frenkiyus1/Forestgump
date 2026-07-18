#!/usr/bin/env bash
#
# Forestgump - khởi động Backend (Node/tsx) và AI Engine (FastAPI) cùng lúc.
# Dùng được trên Linux / macOS / Git Bash / WSL.
#
#   ./start.sh
#
# Ctrl+C để dừng cả hai dịch vụ.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Dừng toàn bộ tiến trình con khi script kết thúc / nhận Ctrl+C.
cleanup() {
  echo ""
  echo "[start] Stopping services..."
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[start] Launching AI Engine (FastAPI) on http://localhost:8000 ..."
( cd "$ROOT/ai_engine" && uvicorn app:app --reload --port 8000 ) &

echo "[start] Launching Backend (Node/tsx) on http://localhost:3000 ..."
( cd "$ROOT/backend" && npm run dev ) &

# Chờ cả hai tiến trình; nếu một cái chết, cleanup sẽ dọn cái còn lại.
wait
