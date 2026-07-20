#!/usr/bin/env bash
set -e

# Smoke-test the local dataset with the oracle agent (no LLM required).
cd "$(dirname "$0")"

# shellcheck source=lib/common.sh
source ./lib/common.sh

export PYTHONIOENCODING=utf-8

HARBOR_BIN=$(find_harbor_bin) || {
  echo "ERROR: harbor binary not found" >&2
  exit 1
}

echo "==> Harbor smoke test (oracle)"
run_harbor_logged results/run-smoke.log \
  "$HARBOR_BIN" run \
  -p "tasks" \
  -a oracle \
  --n-concurrent 1

echo ""
echo "==> Smoke test complete. Check jobs/ and results/run-smoke.log."
