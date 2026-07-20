#!/usr/bin/env bash
# Do not use `set -e`: we need to record the pytest exit code and write the
# reward file regardless of whether the tests pass or fail.
set -uo pipefail

WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"
TEST_DIR="${TEST_DIR:-/tests}"
REWARD_FILE="${REWARD_FILE:-/logs/verifier/reward.txt}"

cd "$WORKSPACE_DIR"
mkdir -p "$(dirname "$REWARD_FILE")"

pytest "$TEST_DIR/test_outputs.py" -rA -v
PYTEST_EXIT_CODE=$?

if [ "$PYTEST_EXIT_CODE" -eq 0 ]; then
    echo 1 > "$REWARD_FILE"
else
    echo 0 > "$REWARD_FILE"
fi

exit "$PYTEST_EXIT_CODE"
