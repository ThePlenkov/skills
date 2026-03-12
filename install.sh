#!/usr/bin/env bash
# Self-install script for GitHub Codespaces dotfiles.
# https://docs.github.com/en/codespaces/setting-your-user-preferences/personalizing-github-codespaces-for-your-account#dotfiles
#
# Installs skills into:
#   ~/.agents/skills/   — universal agent skill registry
#   ~/.claude/skills/   — Claude Code skill symlinks

set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SOURCE="$DOTFILES_DIR/.agents/skills"

TARGETS=(
  "$HOME/.agents/skills"
  "$HOME/.claude/skills"
)

echo "[install] Setting up skills from $DOTFILES_DIR"

# --- Create target directories ---
for target in "${TARGETS[@]}"; do
  mkdir -p "$target"
done

# --- Link each skill directory (those containing SKILL.md) into every target ---
linked=0
while IFS= read -r skill_md; do
  skill_dir="$(dirname "$skill_md")"
  skill_name="$(basename "$skill_dir")"

  for target in "${TARGETS[@]}"; do
    link="$target/$skill_name"

    if [[ -L "$link" ]]; then
      # Update if pointing elsewhere
      if [[ "$(readlink -f "$link")" != "$(readlink -f "$skill_dir")" ]]; then
        rm "$link"
        ln -s "$skill_dir" "$link"
        echo "[install]   updated: $link"
      fi
    elif [[ ! -e "$link" ]]; then
      ln -s "$skill_dir" "$link"
      echo "[install]   linked:  $link"
      linked=$((linked + 1))
    fi
  done
done < <(find "$SKILLS_SOURCE" -name "SKILL.md" -type f)

echo "[install] Done ($linked new link(s))."
echo "[install]   ~/.agents/skills/ — universal skill registry"
echo "[install]   ~/.claude/skills/ — Claude Code skills"
