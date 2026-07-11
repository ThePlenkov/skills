#!/usr/bin/env bash
# Install all skills from this repo by symlinking
#   ~/.agents/skills/personal → <repo>/.agents/skills
#
# One symlink exposes every skill folder under .agents/skills/ as
# ~/.agents/skills/personal/<name>. New skills added to this repo appear
# automatically; no re-run needed.
#
# Usage:
#   scripts/install.sh              # create or refresh the symlink
#   scripts/install.sh --dry-run    # show what would happen
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="${REPO_ROOT}/.agents/skills"
PERSONAL_LINK="${HOME}/.agents/skills/personal"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Source not found: $SOURCE_DIR" >&2
  exit 1
fi

run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

mkdir -p "$(dirname "$PERSONAL_LINK")"

if [ -L "$PERSONAL_LINK" ]; then
  current="$(readlink -f "$PERSONAL_LINK" || true)"
  target="$(readlink -f "$SOURCE_DIR")"
  if [ "$current" = "$target" ]; then
    echo "✓ already linked: $PERSONAL_LINK → $SOURCE_DIR"
    exit 0
  fi
  echo "↻ retargeting $PERSONAL_LINK (was → $(readlink "$PERSONAL_LINK"))"
  run ln -sfn "$SOURCE_DIR" "$PERSONAL_LINK"
elif [ -e "$PERSONAL_LINK" ]; then
  echo "❌ $PERSONAL_LINK exists and is not a symlink. Remove or rename it first." >&2
  exit 1
else
  run ln -s "$SOURCE_DIR" "$PERSONAL_LINK"
fi

echo "✓ linked $PERSONAL_LINK → $SOURCE_DIR"
count=$(find "$SOURCE_DIR" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l)
echo "  skills available: $count"
