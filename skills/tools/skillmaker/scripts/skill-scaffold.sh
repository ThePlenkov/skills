#!/usr/bin/env bash
# Scaffold a new skill directory with a valid SKILL.md template.
# Usage: skill-scaffold.sh <category> <skill-name>
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/../../../.." && pwd -P)
SKILLS_DIR="${REPO_ROOT}/skills"

usage() {
  printf 'Usage: %s <category> <skill-name>\n' "$(basename "$0")"
  printf '\nCreates skills/<category>/<skill-name>/SKILL.md\n'
  printf '\nCategories: behavior, coaching, code-review, experimentation, git,\n'
  printf '  integrations, methodology, orchestration, planning, research,\n'
  printf '  self-learning, testing, tools, troubleshooting\n'
  exit 1
}

[[ "${1:-}" = "--help" ]] && usage
[[ $# -lt 2 ]] && usage

# shellcheck source=ensure-reserved.sh
source "${REPO_ROOT}/scripts/ensure-reserved.sh"

CATEGORY="$1"
NAME="$2"

if [[ ! "$NAME" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  printf 'Error: skill name must be kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$)\n' >&2
  exit 1
fi

if [[ "${RESERVED_SET[$NAME]:-}" = "1" ]]; then
  printf 'Error: "%s" is reserved (conflicts with Claude Code built-in /%s)\n' "$NAME" "$NAME" >&2
  printf 'Rename to something like "%s-cli" or "%s-ext"\n' "$NAME" "$NAME" >&2
  exit 1
fi

SKILL_DIR="${SKILLS_DIR}/${CATEGORY}/${NAME}"

if [[ -d "$SKILL_DIR" ]]; then
  printf 'Error: %s already exists\n' "$SKILL_DIR" >&2
  exit 1
fi

mkdir -p "$SKILL_DIR"

cat > "${SKILL_DIR}/SKILL.md" << TEMPLATE
---
name: ${NAME}
description: "TODO: One-sentence description (10-500 chars)"
tier: 2
triggers: [user, model]
allowed-tools:
  - read
source: theplenkov-ai/skills
---

# ${NAME}

## When to use

TODO

## Workflow

1. TODO
TEMPLATE

printf 'Created %s\n' "${SKILL_DIR}/SKILL.md"
printf '\nNext steps:\n'
printf '  1. Edit the description and workflow\n'
printf '  2. Run: npm run install:skills\n'
printf '  3. Run: npx tsx scripts/run.ts scripts/validate-reserved-names.sh\n'
