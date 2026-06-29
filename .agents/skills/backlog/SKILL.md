---
name: backlog
description: >-
  Actionable improvement items derived from experience and retrospectives.
  Items live in .agents/backlog/.
---

# Backlog

Actionable work items. Unlike memory (knowledge), backlog is about **what to do next**.

## Storage

Write to `.agents/backlog/YYYY-MM-DD-<slug>.md`:

```yaml
---
date: YYYY-MM-DD
tags: [tag1, tag2]
source: <path to memory/experience entry or PR URL>
---

## Problem
<what needs fixing or improving>

## Proposed action
<concrete next step — not a vague idea>
```

## Rules

1. **Actionable only** — every item must have a concrete "Proposed action". Vague ideas go to `.agents/memory/observations/`.
2. **Link to source** — if the item came from a retrospective or experience, reference it in `source:`.
3. **One item per file** — keep atomic, easy to close by deleting the file.
4. **Close by deleting** — when done, remove the file (git tracks history).
5. **Same landscape rules as memory** — [agent-memory-landscape-redaction](../memory/mental-models/agent-memory-landscape-redaction.md): omit real ids; do not substitute fixtures for redacted live values.

## `/backlog <source>` — sources

`/backlog` writes triage into `.agents/backlog/`, but **reads from many places**:

| Source | Reads | Writes | When |
| ------ | ----- | ------ | ---- |
| `harvest` | `.agents/review-debt/harvests/*.jsonl` (plus `ledger.jsonl` for terminal status) | `.agents/backlog/*.md` per row; then runs `bun run harvest:archive` to move fully-triaged harvest files into `archive/harvests/` | After `/harvest` collected threads; before `/act harvest` |
| `gh` | open review threads on a single PR (via `gh pr view … --json …`) | one `backlog/*.md` summarising the PR's threads | Live PR, before `/act pr` |
| `plan` | `.agents/plans/*.md` | one `backlog/*.md` per plan item marked "to backlog" | After a planning round |

The **archive step** is the close-of-loop for `/harvest`. Once every row in a
harvest file has a terminal status in `ledger.jsonl` (`done` / `wontfix` /
`duplicate`), `bun run harvest:archive` moves the file under
`archive/harvests/` and writes a sidecar `*.archived.json` marker. The next
`/harvest` cycle starts from a clean ledger, and the archive keeps an
immutable history of the original payload (useful for the "did we ever fix
this nit?" question).

If you only want to triage a row without archiving, that's fine — the archive
pass is **idempotent** and safe to re-run after every batch.

See [`.agents/skills/harvest/SKILL.md § Lifecycle`](../harvest/SKILL.md#lifecycle-the-full-pipeline)
for the full pipeline diagram.
