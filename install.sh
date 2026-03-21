#!/usr/bin/env bash
set -euo pipefail

# Dotfiles install script — runs automatically when used as a GitHub Codespaces dotfiles repo.
# Installs all skills from this repository to all detected coding agents.

if ! command -v npx &>/dev/null; then
  echo "Error: Node.js / npx is required. Please install Node.js first." >&2
  exit 1
fi

npx skills add . --all -y
