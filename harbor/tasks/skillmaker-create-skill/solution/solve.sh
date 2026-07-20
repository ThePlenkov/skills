#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"
SKILL_DIR="$WORKSPACE_DIR/skills/testing/test-http-check"

mkdir -p "$SKILL_DIR"

cat > "$SKILL_DIR/SKILL.md" << 'EOF'
---
name: test-http-check
description: Check whether an HTTP endpoint is reachable and report its status code.
allowed-tools:
  - exec
  - read
---

# Test HTTP Check

Use this skill to verify that an HTTP endpoint is up and to report its status code.

## Procedure

1. Accept a URL as the argument.
2. Run `curl -s -o /dev/null -w "%{http_code}" <URL>` to get the status code.
3. Report the status code and whether the endpoint is reachable (2xx/3xx = reachable, otherwise not).
EOF
