#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"
REPORT_PATH="${REPORT_PATH:-$WORKSPACE_DIR/investigation_report.md}"

cd "$WORKSPACE_DIR"
# Run tests to collect evidence for the report. A failure is expected here
# because the task is to investigate the bug, not to fix it.
pytest -q || true

cat > "$REPORT_PATH" << 'EOF'
## Investigation target

Why is `test_greet` failing in `tests/test_greet.py`?

## Evidence found

- Running `pytest -q` shows `test_greet` fails with an `AssertionError`.
- The expected output is `"Hello, Alice!"` but the actual output is `"Hello, World!"`.
- Reading `src/greet.py` shows the function ignores the `name` argument and always returns `"Hello, World!"`.

## Likely cause

The `greet` function in `src/greet.py` ignores the `name` argument and returns a hardcoded `"Hello, World!"`. This is the bug.

## Files relevant to patch

- `src/greet.py`

## Suggested next step

Edit `src/greet.py` to use the `name` argument, e.g. `return f"Hello, {name}!"`.

## Commands run

- `pytest -q`
- `cat src/greet.py`
EOF
