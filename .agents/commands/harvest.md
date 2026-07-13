---
description: Collect unresolved PR review threads into review-debt harvests
argument-hint: pr-number
---

Collect unresolved PR review threads into `.agents/review-debt/harvests/*.jsonl` for later triage and fixing.

**What harvest does:**
- Reads unresolved threads on merged PR (isResolved=false, isOutdated=false)
- Classifies by author (ignore_authors / nit_authors from config.json)
- Writes append-only file: `.agents/review-debt/harvests/{ts}-pr-{N}-run-{id}.jsonl`
- Pushes new file to main (no merge conflicts, no bot PR)

**Triggers:**
- PR merge (immediate)
- Post-PR CI completion
- Manual: `/harvest <pr-number>`
- Batch: workflow_dispatch with filters

**Usage:**
```bash
# Single PR
bun .agents/skills/harvest/scripts/harvest-threads.ts OWNER REPO PR

# Batch with filters
bun .agents/skills/harvest/scripts/harvest-debt-batch.ts OWNER REPO --pr-ids 72,67
bun .agents/skills/harvest/scripts/harvest-debt-batch.ts OWNER REPO --merged-since 2026-06-09

# Archive fully-triaged files
bun .agents/skills/harvest/scripts/archive-harvest.ts
```

**Pipeline:**
PR merge → /harvest → harvests/*.jsonl → /backlog (triage) → /act (fix) → archive

**Harvest does NOT:**
- Triage (priority/grouping) - that's /backlog
- Fix code - that's /act
- Update status - that's /act done
- Resolve threads - that's /act P4

**Row schema:**
Each row has: thread_id, thread_url, status, priority, needs, source_pr, fingerprint, area, harvested_at

Apply the full harvest protocol from `.agents/skills/harvest/SKILL.md`.
