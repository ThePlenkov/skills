#!/usr/bin/env bash
set -e

# Run the local dataset against the Devin ACP agent with and without skills.
# Usage: ./run-devin.sh <model> [extra harbor args...]
# Example: ./run-devin.sh openai/gpt-4.1

cd "$(dirname "$0")"

MODEL="${1:-}"
if [ -z "$MODEL" ]; then
  echo "Usage: ./run-devin.sh <model> [extra harbor args...]" >&2
  exit 1
fi
shift || true

AGENT_ARGS=(
  acp
  --agent-kwarg "registry_entry_path=./agents/devin/agent.json"
  -m "$MODEL"
)

AGENT_ENV_ARGS=()
if [ -n "$DEVIN_API_KEY" ]; then
  AGENT_ENV_ARGS+=("--agent-env" "DEVIN_API_KEY=$DEVIN_API_KEY")
fi
if [ -n "$DEVIN_API_SECRET" ]; then
  AGENT_ENV_ARGS+=("--agent-env" "DEVIN_API_SECRET=$DEVIN_API_SECRET")
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
JOBS_DIR="./results/devin-jobs"
WITHOUT_JOB="without-$TIMESTAMP"
WITH_JOB="with-$TIMESTAMP"
mkdir -p "$JOBS_DIR"

echo "==> Devin WITHOUT skills -> $JOBS_DIR/$WITHOUT_JOB"
./run-without-skills.sh "${AGENT_ARGS[@]}" \
  --jobs-dir "$JOBS_DIR" \
  --job-name "$WITHOUT_JOB" \
  "${AGENT_ENV_ARGS[@]}" \
  "$@"

echo ""
echo "==> Devin WITH skills -> $JOBS_DIR/$WITH_JOB"
./run-with-skills.sh "${AGENT_ARGS[@]}" \
  --jobs-dir "$JOBS_DIR" \
  --job-name "$WITH_JOB" \
  "${AGENT_ENV_ARGS[@]}" \
  "$@"

echo ""
echo "==> Comparing"
PYTHON_BIN="$(command -v python3 || command -v python || echo python3)"
"$PYTHON_BIN" compare.py "$JOBS_DIR/$WITHOUT_JOB" "$JOBS_DIR/$WITH_JOB"
