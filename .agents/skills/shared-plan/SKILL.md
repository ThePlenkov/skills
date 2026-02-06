---
name: shared-plan
description: Shared, persistent planning and retrospectives across agents and people. Use when planning work, coordinating parallel tasks, recording decisions, tracking ownership, or handing off work via git so another agent or person can pick up the plan later.
---

# Shared Plan

## Overview
Maintain a single, versioned plan file that any agent or person can update and continue later via git pull.

## Workflow

1. **Locate the shared plan**
   - Primary plan file: `~/.agents/shared-plan/plan.md`
   - Retrospective log: `~/.agents/shared-plan/retrospective.md`
   - Create the files if missing.

2. **Update the plan, don’t restart it**
   - Preserve history; append or edit the relevant sections.
   - Add a timestamp and owner on each update.

3. **Keep it actionable**
   - Separate parallel tasks, ownership, and next actions.
   - Record decisions and sources used to validate them.

4. **After mistakes or rework**
   - Add a brief retrospective entry: cause, fix, prevention.

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
