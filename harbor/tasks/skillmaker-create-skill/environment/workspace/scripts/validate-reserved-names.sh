#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source scripts/reserved-names.sh

ERRORS=0
# Discover skills under nested categories as well as top-level categories.
while IFS= read -r skill_dir; do
  name=$(basename "$skill_dir")
  for reserved in "${RESERVED_NAMES[@]}"; do
    if [ "$name" = "$reserved" ]; then
      echo "ERROR: Skill name '$name' conflicts with reserved name" >&2
      ERRORS=$((ERRORS + 1))
    fi
  done
done < <(find skills -mindepth 2 -type d)

if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi
