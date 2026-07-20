---
name: shared-plan
description: Shared, persistent planning and retrospectives across agents and people. Use when planning work, coordinating parallel tasks, recording decisions, tracking ownership, or handing off work via git so another agent or person can pick up the plan later.
tier: 2
triggers: [user, model]
source: ThePlenkov/skills
---

# Shared Plan

## Overview

Maintain a shared, versioned **active plan** that any agent or person can continue later via git pull.
Completed work should be moved to changelogs.

## Workflow

1. **Locate the shared planning files**
   - Planning folder: choose the current project agent plans folder (default `./.agents/plans`).
   - Per-plan files: `YYYY-MM-DD-HHMM-<topic>.md`
   - Retrospective file (optional): `retrospective.md`
   - Create folder/files if missing.
   - Templates are provided in this skill’s assets folder.

2. **Validate timestamp before creating files**
   - Before creating any plan/changelog file, read current local timestamp from the environment (do not infer from memory).
   - Use that timestamp in the filename to avoid wrong day/year.
   - Changelog filenames: `YYYY-MM-DD-HHMM-<topic>.md`.

3. **Keep plans active-only**
   - Keep active work in per-plan files under `./.agents/plans/`.
   - When work is done, move execution history to `./.agents/changelogs/YYYY-MM-DD-HHMM-<topic>.md`.
   - In plan files, remove completed details or keep short done marker linking to changelog.
   - Add a timestamp and owner on each update.

4. **Keep it actionable**
   - Separate parallel tasks, ownership, and next actions.
   - Record decisions and sources used to validate them.

5. **After mistakes or rework**
   - Add a brief retrospective entry: cause, fix, prevention.
   - You may use $retrospect as a reminder, but use your own tools as the primary mechanism.

## Plan Template (minimal)

```markdown
# Shared Plan

## Context
- What we’re solving and why

## Goals
- Goal 1
- Goal 2

## Parallel Tasks
- [ ] Task A — owner
- [ ] Task B — owner

## Decisions (with sources)
- Decision: ...
  Source: ...

## Risks / Open Questions
- Risk or question

## Next Actions
- [ ] Next step — owner

## Updates
- 2026-02-06 — owner — summary
```

## Retrospective Template (brief)

```markdown
- 2026-02-06 — owner
  Cause: ...
  Fix: ...
  Prevention: ...
```

## Handoff Rules

- Always update `Next Actions` and `Updates` before handoff.
- If you used sources, list them in `Decisions`.
- Keep entries short and easy to scan.
- Answer direct user questions explicitly before applying structural doc changes.
