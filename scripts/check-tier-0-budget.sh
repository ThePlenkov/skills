#!/usr/bin/env bash
# Enforce the Tier 0 always-on skill budget (≤ 300 lines).
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
total=0

files=()
while IFS= read -r f; do
  [[ -n "$f" ]] && files+=("$f")
done < <(grep -rl --include=SKILL.md '^tier:[[:space:]]*0' "$REPO_ROOT/skills/" || true)

if [[ ${#files[@]} -gt 0 ]]; then
  for f in "${files[@]}"; do
    lines=$(wc -l < "$f")
    echo "$lines  $f"
    total=$((total + lines))
  done
fi

echo "Total Tier 0: $total lines (must be ≤ 300)"

if [[ "$total" -gt 300 ]]; then
  echo "::error::Tier 0 always-on skills total $total lines, exceeding the 300-line budget" >&2
  exit 1
fi
