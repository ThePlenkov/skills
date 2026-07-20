#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
JOBS_DIR="./results/oracle-jobs"
WITHOUT_JOB="without-$TIMESTAMP"
WITH_JOB="with-$TIMESTAMP"
mkdir -p "$JOBS_DIR"

echo "==> Running WITHOUT skills (oracle) -> $JOBS_DIR/$WITHOUT_JOB"
./run-without-skills.sh oracle --jobs-dir "$JOBS_DIR" --job-name "$WITHOUT_JOB"

echo ""
echo "==> Running WITH skills (oracle) -> $JOBS_DIR/$WITH_JOB"
./run-with-skills.sh oracle --jobs-dir "$JOBS_DIR" --job-name "$WITH_JOB"

echo ""
echo "==> Comparing"
PYTHON_BIN="$(command -v python3 || command -v python || echo python)"
REPORT_FILE="./results/oracle-smoke.md"

{
  echo "# SkillsBench local smoke test — oracle baseline"
  echo ""
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  "$PYTHON_BIN" compare.py "$JOBS_DIR/$WITHOUT_JOB" "$JOBS_DIR/$WITH_JOB"
} > "$REPORT_FILE"

echo "==> Report written to $REPORT_FILE"
cat "$REPORT_FILE"
