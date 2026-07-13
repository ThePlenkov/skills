#!/usr/bin/env bash
# GitHub Codespaces dotfiles entrypoint — auto-runs on codespace creation.
# Delegates to scripts/install.sh with --home, which creates flat
# ~/.agents/skills/<skill-name> symlinks to the skills in this repo.
set -euo pipefail
exec "$(dirname "$0")/scripts/install.sh" --home "$@"
