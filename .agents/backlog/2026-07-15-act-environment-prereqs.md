---
date: 2026-07-15
tags: [act, environment, bun]
source: .memory/experience/2026-07-15-act-network-and-bun.md
---

## Problem

Running `/act` on PR #50 was blocked until `api.github.com`/`github.com` were added to the session network allowlist and `bun` was manually installed. The `/act` skill lists these as environment preconditions, but the default environment did not satisfy them.

## Proposed action

Add a repo-level environment setup step (blueprint or `scripts/ensure-act-env.sh`) that checks for and, if missing, installs `bun` locally and verifies `gh` auth and network access before `/act` runs. This would make `/act` self-contained for future sessions.
