---
date: 2026-07-24
tags: [act, scripts, efficiency, graphql, /act]
source: .memory/experience/2026-07-24-act-p5-p6-skip-cycle-misread.md
---

## Problem

The `scripts/resolve-open-threads.sh` script (used by `/act` P4) resolves
**every** open thread on a PR in one batch. When the agent needs to
keep one thread open for a human/owner decision (e.g. a convention
question that needs explicit sign-off) and resolve the rest, there is
no script-level way to express the exclusion. The agent falls back to
making N individual `gh api graphql` calls, which burns N tool calls
and is brittle to rate limits.

PR #148 round 4 needed exactly this: resolve 15 of 16 new threads
while leaving the long-standing `source:` convention thread open for
the user. The script had to be bypassed.

## Proposed action

Add a `scripts/resolve-threads.sh` sibling that takes a list of
thread IDs (newline-delimited, one ID per line) and resolves only
those. The agent generates the list by selecting threads to close
from the `pr-state.sh` / `extract-findings.ts` output. Use `.sh`
(executable script) not `.tsv` (data file) for the script name; the
established convention in `scripts/` is for scripts to use `.sh` and
consume `.tsv` data files via `--file PATH` (see `reply-threads.sh`
and `resolve-open-threads.sh`). The data file itself is the input
list — it is plain text with one thread ID per line, NOT a
TAB-separated multi-column file (the input is a set of IDs, not rows
of fields). Keep `resolve-open-threads.sh` for the "resolve all"
case (the common path). Both can share the same underlying GraphQL
mutation helper.

## Acceptance criteria

- [ ] `scripts/resolve-threads.sh [--file PATH] [--dry-run]` resolves
      only the threads listed in the file (one thread ID per line,
      plain text — not a two-column TSV).
- [ ] `--dry-run` reports the planned batch count and thread IDs
      without POSTing.
- [ ] On rate-limit / auth failure, the script exits non-zero with
      a clear error (matches the pattern of `resolve-open-threads.sh`).
- [ ] Round-trip test: a self-contained `bash` test that pipes a
      known list of N fake thread IDs to the script with
      `GITHUB_GRAPHQL_URL` pointed at a local mock server (e.g.
      `npx --yes http-server` returning a stubbed
      `resolveReviewThread` payload), and asserts the mock saw
      exactly N calls with the expected IDs in the right order. The
      test MUST NOT depend on any external "local-memory lesson"
      that isn't part of this repo — the harness setup and the
      assertion both live in the test file itself.
- [ ] Documented in `AGENTS.md` § `scripts/` next to the
      `resolve-open-threads.sh` reference, with the "use this when
      you need to leave a decision thread open" trigger.
