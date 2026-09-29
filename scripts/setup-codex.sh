#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 22+ and npm are required." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm ci --ignore-scripts
fi
npm run build
exec node dist/cli.js setup codex "$@"
