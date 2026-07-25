#!/usr/bin/env bash
# Install the EyeMap GPU worker as a systemd --user service.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
UNIT_SRC="$ROOT/eyemap-worker.service"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_DST="$UNIT_DIR/eyemap-worker.service"

if [[ ! -f "$ROOT/worker.env" ]]; then
  echo "Create $ROOT/worker.env from worker.env.example first"
  exit 1
fi

if [[ ! -x "$ROOT/.venv/bin/python" ]]; then
  echo "Creating venv…"
  python3 -m venv "$ROOT/.venv"
  "$ROOT/.venv/bin/pip" install -r "$ROOT/requirements.txt"
fi

mkdir -p "$UNIT_DIR"

# Rewrite WorkingDirectory / paths in the unit to this machine's absolute paths
sed \
  -e "s|%h/eyemap/clinica/worker|$ROOT|g" \
  "$UNIT_SRC" > "$UNIT_DST"

systemctl --user daemon-reload
systemctl --user enable --now eyemap-worker.service
systemctl --user status eyemap-worker.service --no-pager
echo "Installed. Logs: journalctl --user -u eyemap-worker -f"
