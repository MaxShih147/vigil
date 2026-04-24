#!/usr/bin/env bash
# Thin launcher used by systemd (and humans) to start vigil-uploader.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

if [[ -d "$REPO_ROOT/.venv" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.venv/bin/activate"
fi

exec python3 "$REPO_ROOT/scripts/uploader.py" "$@"
