#!/usr/bin/env bash
# GitHub Codespaces dotfiles entrypoint — auto-runs on codespace creation.
# Delegates to scripts/install.sh, which creates the single
# ~/.agents/skills/personal symlink exposing all skills in this repo.
set -euo pipefail
exec "$(dirname "$0")/scripts/install.sh" "$@"
