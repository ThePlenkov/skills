#!/usr/bin/env bash
set -e

# Run the local dataset with skills injected.
# Usage: ./run-with-skills.sh <agent> [model] [extra harbor args...]
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

# Relative to this script's directory (harbor/)
SKILL_ARGS=(
  "--skill" "../skills/tools/skillmaker"
  "--skill" "../skills/behavior/investigate-first"
)

cmd=("$HARBOR_BIN" run \
  -p "tasks" \
  -a "$AGENT" \
  --n-concurrent 1 \
  "${SKILL_ARGS[@]}")

if [ -n "$MODEL" ]; then
  cmd+=("-m" "$MODEL")
fi

cmd+=("$@")

mkdir -p results
LOG_FILE="${LOG_FILE:-results/run-with-skills.log}"

echo "==> Running WITH skills: ${SKILL_ARGS[*]} (logging to $LOG_FILE)"
run_harbor_logged "$LOG_FILE" "${cmd[@]}"
