# LEARNINGS.md

Searchable repository of lessons learned from retrospect analysis. Use to prevent repeating mistakes.

## How to Use

**Before significant actions** (code changes, major decisions, implementations):

1. Identify 2-3 keywords matching your current task
2. Search this file for those keywords (Ctrl+F or grep)
3. If you find matching guardrails, apply the "IF/THEN" rule to your context

**Format of entries:**

```
[YYYY-MM-DD] [H/M/L] [user|project|agent] IF <trigger condition>, THEN <action>
```

- **H**: High severity (harm, data loss, critical requirement miss)
- **M**: Medium severity (rework, friction, but recoverable)
- **L**: Low severity (minor inefficiency, style)
- **Context**: `user` (setup/expectations), `project` (repo/conventions), `agent` (execution/limits)

---

## Index by Category

### Requirements & Clarity

- [2024-01-15] [H] [user] IF requirements are ambiguous or implicit, THEN ask clarifying questions and confirm assumptions before implementation
- [2024-01-14] [H] [project] IF task involves multiple agents/coordinators, THEN verify scope and ownership before starting work
- [2024-01-10] [M] [user] IF user goals conflict with constraints, THEN surface the conflict explicitly and propose options

### Execution & Implementation

- [2024-01-12] [H] [agent] IF making file changes, THEN always use appropriate tools (write_file/edit_file) and verify changes match intent
- [2024-01-11] [M] [agent] IF working with unfamiliar code, THEN read the full file before making edits to avoid breaking implicit dependencies
- [2024-01-09] [M] [project] IF committing code, THEN verify all tests pass and linting rules are satisfied

### Reasoning & Problem Solving

- [2024-01-13] [M] [agent] IF solving a complex problem, THEN break it into smaller sub-problems and verify each step before proceeding
- [2024-01-08] [M] [user] IF assumptions are unclear, THEN explicitly state them and ask for validation rather than proceeding with guesses

### Communication & Clarity

- [2024-01-07] [M] [agent] IF delegating a subtask to another model instance, THEN provide clear context, expected output, and constraints in the handoff payload
- [2024-01-06] [L] [agent] IF presenting findings, THEN structure output with clear sections and avoid vague statements

### Git & Version Control

- [2024-01-05] [M] [project] IF making large refactors, THEN commit incrementally with clear messages rather than one giant change

### Testing & Validation

- [2024-01-04] [H] [project] IF writing code changes, THEN verify tests exist or create new ones; validate before committing
- [2024-01-03] [M] [agent] IF uncertain about correctness, THEN test with a smaller example before scaling to full solution

### Configuration & Setup

- [2024-01-02] [M] [user] IF agent setup is unclear or missing, THEN explicitly confirm environment, tools, and constraints before proceeding

---

## New Learnings

Add new entries here when retrospect analysis completes. Format:

```
[YYYY-MM-DD] [H/M/L] [user|project|agent] IF <condition>, THEN <action>
```

Example:

```
[2024-01-20] [M] [agent] IF coordinator receives ambiguous routing request, THEN call get_memories() first to check for prior context
```

[2026-02-18] [M] [agent] IF using `shared-plan` for a completed one-off task, THEN keep `docs/planning/plan.md` active-only and move execution history to `docs/changelogs/YYYY-MM-DD-<topic>.md`.
[2026-02-18] [M] [agent] IF user asks a direct question (e.g., "which skill?"), THEN answer it first explicitly before proposing or making structural file changes.
[2026-03-15] [M] [project] IF adding a pre-save comparison hook (like `checkPendingSourcesUnchanged`) that fetches remote state, THEN ensure the comparison result is cached/passed to the actual save method to avoid double-fetching. In `clas.model.ts`, both `checkPendingSourcesUnchanged()` and `savePendingSources()` independently fetch each include source from SAP — this doubles the GET requests for changed objects.
[2026-03-15] [H] [project] IF implementing a new ADK object type with `savePendingSources()`, THEN also implement `checkPendingSourcesUnchanged()` for skip-unchanged support. Currently only CLAS has it; INTF, PROG, FUGR do not.
[2026-03-15] [M] [project] IF format-specific logic (abapGit folder logic, OAT structure, etc.) appears in the generic export command (`adt-export`), THEN move it into the format plugin. The export command must remain format-agnostic — plugins receive `ExportOptions` and resolve their own concerns.
[2026-03-15] [M] [agent] IF user reports a "misleading SAP error", THEN trace the exact HTTP call that fails (lock vs PUT vs activate) before proposing a fix. The error "does not have any inactive version" was assumed to be an activation error but was actually a source PUT failure.
[2026-03-15] [L] [project] IF accessing `_pendingSources` or `_pendingSource` on AdkObject, THEN use the typed accessor pattern (a protected method) instead of repeated `(this as unknown as {...})` casts. The cast pattern appears 13+ times in `clas.model.ts` alone — a refactor target.
