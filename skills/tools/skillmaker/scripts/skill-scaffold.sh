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

# shellcheck disable=SC1091
# shellcheck source=scripts/ensure-reserved.sh
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

capitalize_words() {
  local input="$1"
  local output=""
  local word
  IFS='-' read -ra words <<< "$input"
  for word in "${words[@]}"; do
    word="${word,,}"
    word="${word^}"
    output+="${word} "
  done
  printf '%s' "${output% }"
}

DISPLAY_NAME=$(capitalize_words "$NAME")
SHORT_DESCRIPTION="Help with ${DISPLAY_NAME}"
if [[ ${#SHORT_DESCRIPTION} -lt 25 ]]; then
  SHORT_DESCRIPTION="${SHORT_DESCRIPTION} tasks and workflows"
fi
if [[ ${#SHORT_DESCRIPTION} -gt 64 ]]; then
  SHORT_DESCRIPTION="${DISPLAY_NAME:0:61}..."
fi
if [[ ${#SHORT_DESCRIPTION} -lt 25 ]]; then
  SHORT_DESCRIPTION="Help with ${SHORT_DESCRIPTION}"
fi

SKILL_SOURCE='theplenkov-ai/skills'
if remote_url=$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null); then
  case "$remote_url" in
    *://*)
      remote_url=${remote_url#*://}
      remote_url=${remote_url#*/}
      ;;
    *:*/*)
      remote_url=${remote_url#*:}
      ;;
  esac
  remote_url=${remote_url%.git}
  remote_url=${remote_url%/}
  if [[ "$remote_url" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    SKILL_SOURCE="$remote_url"
  fi
fi
cat > "${SKILL_DIR}/SKILL.md" << TEMPLATE
---
name: ${NAME}
description: "TODO: One-sentence description (10-500 chars)"
---

# ${NAME}

## When to use

TODO

## Workflow

1. TODO
TEMPLATE

mkdir -p "${SKILL_DIR}/agents"

cat > "${SKILL_DIR}/agents/openai.yaml" << TEMPLATE
interface:
  display_name: "${DISPLAY_NAME}"
  short_description: "${SHORT_DESCRIPTION}"
  brand_color: "#3B82F6"
  default_prompt: "Use \$${NAME} to get started."
TEMPLATE

# shellcheck disable=SC2016
REPO_ROOT="$REPO_ROOT" SKILL_NAME="$NAME" SKILL_SOURCE="$SKILL_SOURCE" node -e '
const fs = require("node:fs");
const path = require("node:path");
const repoRoot = process.env.REPO_ROOT;
const configPath = path.join(repoRoot, "skills.config.ts");
const name = process.env.SKILL_NAME;
const source = process.env.SKILL_SOURCE || "theplenkov-ai/skills";
if (!name) throw new Error("SKILL_NAME not set");
let text = fs.readFileSync(configPath, "utf8");
const sourceField = source && source !== "theplenkov-ai/skills"
  ? `,\n        "source": "${source}"`
  : "";
const entry = `  "${name}": {\n    frontmatter: {\n      metadata: {\n        "tier": 2,\n        "triggers": ["user", "model"]${sourceField}\n      },\n    },\n  },\n`;
if (!text.includes(`"${name}"`)) {
  text = text.replace(/\n};\s*$/, "\n" + entry + "};");
  fs.writeFileSync(configPath, text);
  console.log(`Added ${name} to skills.config.ts`);
}
'

printf 'Created %s and %s\n' "${SKILL_DIR}/SKILL.md" "${SKILL_DIR}/agents/openai.yaml"
printf '\nNext steps:\n'
printf '  1. Edit the description, workflow, and agents/openai.yaml\n'
printf '  2. Add any runtime metadata (allowed-tools, conflicts_with, etc.) to skills.config.ts if needed\n'
printf '  3. Run: npm run install:skills\n'
printf '  4. Run: npx tsx scripts/run.ts scripts/validate-reserved-names.sh\n'
