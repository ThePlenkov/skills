#!/usr/bin/env bash
# Land append-only harvest files on main (rebase + retry). Safe: unique filenames per run.
set -euo pipefail

TITLE="${1:?commit title required}"
HARVEST_DIR=".agents/review-debt/harvests"

if [ -z "$(git status --porcelain "${HARVEST_DIR}/" 2>/dev/null)" ]; then
  echo "No new harvest files"
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add "${HARVEST_DIR}/"
git commit -m "${TITLE}"

for attempt in 1 2 3 4 5; do
  git pull --rebase origin main
  if git push origin HEAD:main; then
    echo "Landed harvest files on main"
    exit 0
  fi
  echo "Push to main rejected (attempt ${attempt}/5), retrying…"
  sleep $((attempt * 2))
done

echo "::error::Failed to push harvest files to main after 5 attempts"
exit 1
