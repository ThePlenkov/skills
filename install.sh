#!/usr/bin/env bash
# Self-install script for GitHub Codespaces dotfiles.
# https://docs.github.com/en/codespaces/setting-your-user-preferences/personalizing-github-codespaces-for-your-account#dotfiles
#
# Installs skills into:
#   ~/.agents/skills/   — universal agent skill registry
#   ~/.claude/skills/   — Claude Code skill symlinks

set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_DIR="$HOME/.agents"
SKILLS_JSON="$AGENTS_DIR/skills.json"
SYNC_SCRIPT="$DOTFILES_DIR/.agents/skills/.system/dotagents/scripts/sync.sh"

echo "[install] Setting up skills from $DOTFILES_DIR"

# --- Install jq if needed (required by sync.sh) ---
if ! command -v jq >/dev/null 2>&1; then
  echo "[install] jq not found, attempting to install..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get install -y --no-install-recommends jq
  elif command -v brew >/dev/null 2>&1; then
    brew install jq
  else
    echo "[install] ERROR: jq is required but could not be installed automatically." >&2
    echo "[install] Install it manually and re-run: apt-get install jq | brew install jq | yum install jq" >&2
    exit 1
  fi
fi

# --- Create directory structure ---
mkdir -p "$AGENTS_DIR/skills"
mkdir -p "$HOME/.claude/skills"

# --- Write ~/.agents/skills.json (skip if already present) ---
if [[ ! -f "$SKILLS_JSON" ]]; then
  echo "[install] Writing $SKILLS_JSON"
  cat > "$SKILLS_JSON" <<EOF
{
  "sources": [
    {
      "prefix": "skills",
      "path": "$DOTFILES_DIR"
    }
  ],
  "targets": [
    {
      "path": "$AGENTS_DIR/skills",
      "flat": true,
      "name_style": "basename"
    },
    {
      "path": "$HOME/.claude/skills",
      "flat": true,
      "name_style": "basename"
    }
  ]
}
EOF
else
  echo "[install] $SKILLS_JSON already exists, skipping"
fi

# --- Sync skills ---
echo "[install] Syncing skills..."
bash "$SYNC_SCRIPT"

echo "[install] Done."
echo "[install]   ~/.agents/skills/ — universal skill registry"
echo "[install]   ~/.claude/skills/ — Claude Code skills"
