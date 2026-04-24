#!/usr/bin/env bash
# Thin launcher used by systemd (and humans) to start vigil-recorder.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -d "$REPO_ROOT/.venv" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.venv/bin/activate"
fi

exec python3 "$REPO_ROOT/scripts/recorder.py" "$@"
