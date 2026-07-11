#!/usr/bin/env bash
#
# to-annotations.sh — convert CI tool output to GitHub Actions workflow commands.
#
# Usage:
#   to-annotations.sh <tool>
#
# Where <tool> ∈ {shellcheck, markdownlint, ajv}
#
# Reads tool output from stdin and emits GitHub workflow commands to stdout:
#   ::error file=…,line=…,title=…::message
#   ::warning file=…,line=…,title=…::message
#   ::notice file=…,line=…,title=…::message
#
# Reference:
#   https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
#
# NOTE: SARIF-emitting tools (SkillSpector, CodeQL, Snyk, etc.) are NOT
# handled here. Use the reusable skill at
# `.agents/skills/sarif-to-annotations/scripts/to-annotations.py` for that.

set -euo pipefail

tool="${1:-}"

# Resolve the script directory (so callers don't need to chdir).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSERS_DIR="${SCRIPT_DIR}/parsers"

# Find a Python interpreter. python3 is always present on GitHub-hosted
# ubuntu-latest runners; local dev falls back to `python`.
PY="$(command -v python3 || command -v python || true)"

case "$tool" in
  # Tool names match their Python script filenames 1:1 for the three
  # Python-backed parsers, so a single pattern dispatches all three
  # without duplication.
  #
  # Note: skillspector is NOT handled here. Its findings are routed
  # through .agents/skills/sarif-to-annotations/scripts/to-annotations.py
  # (a separate SARIF→annotations converter in the reusable skill).
  # An earlier version of this script included a skillspector case
  # pointing at ${PARSERS_DIR}/skillspector.jq, but the .jq filter was
  # retired alongside the Python orchestrator in PR #11; keeping the
  # case would cause a jq file-not-found error on any invocation.
  shellcheck|markdownlint|ajv)
    if [ -z "$PY" ]; then
      echo "::error title=to-annotations::python3 not found in PATH" >&2
      exit 2
    fi
    "$PY" "${PARSERS_DIR}/${tool}.py"
    ;;

  *)
    echo "::error title=to-annotations::unknown tool '$tool' (expected: shellcheck|markdownlint|ajv). For SARIF (skillspector), use .agents/skills/sarif-to-annotations/scripts/to-annotations.py" >&2
    exit 2
    ;;
esac