#!/usr/bin/env bash
# Validate that no skill uses a name reserved by built-in commands.
# Exit 1 if any reserved name is found; 0 otherwise.
set -euo pipefail

# shellcheck source=ensure-reserved.sh
source "$(dirname "$0")/ensure-reserved.sh"

# shellcheck source=scan-skills.sh
source "$(dirname "$0")/scan-skills.sh"

FAILED=0

for skill_dir in "${SKILL_DIRS[@]}"; do
  rel=${skill_dir#"${SCAN_SOURCE_DIR}/"}
  name=$(basename "$rel")

  if [[ "${RESERVED_SET[$name]:-}" = "1" ]]; then
    echo "::error file=${skill_dir}/SKILL.md,title=reserved-name::Skill name '${name}' conflicts with a built-in command '/${name}'. Rename the skill."
    FAILED=1
  fi
done

if [[ "$FAILED" = 1 ]]; then
  echo "❌ One or more skills use reserved names." >&2
  exit 1
fi

echo "✅ No reserved name conflicts found."
exit 0
