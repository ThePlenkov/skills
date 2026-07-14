#!/usr/bin/env bash
# Shared: scan skills/<category>/<skill>/SKILL.md and populate SKILL_DIRS array.
# Source this from scripts that need to iterate over skills.
#
# After sourcing, SKILL_DIRS contains skill directory paths (one per valid skill).
# Skips nested skills (child SKILL.md inside a parent skill directory).
#
# Usage:
#   source "${SCRIPT_DIR}/scan-skills.sh"
#   for dir in "${SKILL_DIRS[@]}"; do ... done

SCAN_SOURCE_DIR="${SCAN_SOURCE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)/skills}"

SKILL_DIRS=()
while IFS= read -r -d '' skill_file; do
  skill_dir=$(dirname "$skill_file")

  skip=0
  parent_dir=$skill_dir
  while [[ "$parent_dir" != "$SCAN_SOURCE_DIR" ]]; do
    parent_dir=$(dirname "$parent_dir")
    if [[ "$parent_dir" = "$SCAN_SOURCE_DIR" ]]; then
      break
    fi
    if [[ -f "$parent_dir/SKILL.md" ]]; then
      skip=1
      break
    fi
  done

  if [[ "$skip" = 1 ]]; then
    continue
  fi

  SKILL_DIRS+=("$skill_dir")
done < <(find "$SCAN_SOURCE_DIR" -mindepth 3 -name SKILL.md -print0 | sort -z)
