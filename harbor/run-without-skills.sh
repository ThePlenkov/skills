#!/usr/bin/env bash
set -e

# Run the local dataset without injecting any skills (baseline).
# Usage: ./run-without-skills.sh <agent> [model] [extra harbor args...]
cd "$(dirname "$0")"

# shellcheck source=lib/common.sh
source ./lib/common.sh

AGENT="${1:-<agent>}"
shift || true

MODEL=""
if [ $# -gt 0 ] && [[ "$1" != --* ]]; then
  MODEL="$1"
  shift
fi

HARBOR_BIN=$(find_harbor_bin) || {
  echo "ERROR: harbor binary not found" >&2
  exit 1
}

export PYTHONIOENCODING=utf-8

cmd=("$HARBOR_BIN" run \
  -p "tasks" \
  -a "$AGENT" \
  --n-concurrent 1)

if [ -n "$MODEL" ]; then
  cmd+=("-m" "$MODEL")
fi

cmd+=("$@")

mkdir -p results
LOG_FILE="${LOG_FILE:-results/run-without-skills.log}"

echo "==> Running WITHOUT skills (logging to $LOG_FILE)"
run_harbor_logged "$LOG_FILE" "${cmd[@]}"
