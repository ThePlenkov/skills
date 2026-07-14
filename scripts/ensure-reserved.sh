#!/usr/bin/env bash
# Shared: ensure reserved-names.sh exists and is fresh, then source it.
# Source this from scripts that need RESERVED_NAMES / RESERVED_SET.
#
# Usage:
#   source "$(dirname "$0")/ensure-reserved.sh"
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)}"
RESERVED_FILE="${REPO_ROOT}/scripts/reserved-names.sh"
COLLECT="${REPO_ROOT}/skills/tools/skillmaker/scripts/collect-reserved.sh"
AGENTS_DIR="${REPO_ROOT}/skills/tools/skillmaker/assets/agents"

generate=0
if [[ ! -f "$RESERVED_FILE" ]]; then
  generate=1
else
  # Regenerate if any YAML source is newer than the generated file.
  for yaml in "$AGENTS_DIR"/*.yaml; do
    [[ -f "$yaml" ]] || continue
    if [[ "$yaml" -nt "$RESERVED_FILE" ]]; then
      generate=1
      break
    fi
  done
fi

if [[ "$generate" = 1 ]]; then
  if [[ -f "$COLLECT" ]] && command -v python3 >/dev/null 2>&1; then
    bash "$COLLECT" "$RESERVED_FILE"
  else
    printf 'error: %s is missing or stale and cannot be regenerated (python3 required)\n' "$RESERVED_FILE" >&2
    exit 1
  fi
fi

# shellcheck source=reserved-names.sh
source "$RESERVED_FILE"
