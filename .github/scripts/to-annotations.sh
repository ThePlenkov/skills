#!/usr/bin/env bash
#
# to-annotations.sh — convert CI tool output to GitHub Actions workflow commands.
#
# Usage:
#   to-annotations.sh <tool>
#
# Where <tool> ∈ {skillspector, shellcheck, markdownlint, ajv}
#
# Reads tool output from stdin and emits GitHub workflow commands to stdout:
#   ::error file=…,line=…,title=…::message
#   ::warning file=…,line=…,title=…::message
#   ::notice file=…,line=…,title=…::message
#
# Reference:
#   https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands

set -euo pipefail

tool="${1:-}"

# Resolve the script directory (so callers don't need to chdir).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSERS_DIR="${SCRIPT_DIR}/parsers"

# Prefer jq for skillspector (it's the cleanest jq fit). For everything else,
# dispatch to a dedicated Python parser script. python3 is always present on
# GitHub-hosted ubuntu-latest runners; local dev falls back to `python`.

case "$tool" in
  skillspector)
    jq -rf "${PARSERS_DIR}/skillspector.jq"
    ;;

  shellcheck)
    PY="$(command -v python3 || command -v python || true)"
    if [ -z "$PY" ]; then
      echo "::error title=to-annotations::python3 not found in PATH" >&2
      exit 2
    fi
    "$PY" "${PARSERS_DIR}/shellcheck.py"
    ;;

  markdownlint)
    PY="$(command -v python3 || command -v python || true)"
    if [ -z "$PY" ]; then
      echo "::error title=to-annotations::python3 not found in PATH" >&2
      exit 2
    fi
    "$PY" "${PARSERS_DIR}/markdownlint.py"
    ;;

  ajv)
    PY="$(command -v python3 || command -v python || true)"
    if [ -z "$PY" ]; then
      echo "::error title=to-annotations::python3 not found in PATH" >&2
      exit 2
    fi
    "$PY" "${PARSERS_DIR}/ajv.py"
    ;;

  *)
    echo "::error title=to-annotations::unknown tool '$tool' (expected: skillspector|shellcheck|markdownlint|ajv)" >&2
    exit 2
    ;;
esac