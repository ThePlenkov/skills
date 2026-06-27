---
name: retrospect
description: Self-correction protocol for AI agents. Use when a mistake is made, a correction is received, or lessons need to be captured to prevent recurrence.
---

# Retrospect

When something goes wrong, the agent must stop, understand why, and **persist a fix that actually prevents recurrence**.

## Core Principle

> A retrospection is only successful if the mistake **cannot happen again** in the same context.

The agent decides HOW to persist the fix — memory, skill update, `AGENTS.md` change, code comment, project docs — whatever mechanism is most effective for the specific finding. There is no single right answer.

## Protocol

### 1. Stop

Stop the current approach immediately. Acknowledge the mistake. Don't continue hoping it will work out.

### 2. Understand

- **What went wrong?** — describe precisely
- **Why?** — missing context? wrong assumption? ignored conventions?
- **Is this a pattern?** — has this happened before?

### 3. Determine Scope

The fix must land at the right level:

| Scope | When | Examples |
|-------|------|---------|
| **Universal** | Applies to all agents, all projects | Update `AGENTS.md` or `.agents/skills/` |
| **Project** | Specific to this codebase | Update project docs, README, config |
| **Agent** | Specific to this agent's behavior | Agent memory, tool-specific rules |
| **Session** | One-off, won't recur | Mental note, no persistence needed |

**Key rule**: extend existing rules rather than creating new ones. One source of truth per topic.

### 4. Persist the Fix

The agent chooses the persistence mechanism based on scope and its own capabilities:

- **Skill update** — if the finding improves a skill's instructions
- **AGENTS.md** — if it's a universal project rule
- **Agent memory** — if it's agent-specific context
- **Code comments** — if it's implementation-level
- **Project docs** — if it's project-specific knowledge

The only requirement: **the fix must be where the agent (or another agent) will encounter it before making the same mistake**.

### 5. Apply Now

Apply the learning to the current task immediately. Don't just document it for the future.

## Authority Hierarchy

When rules conflict:

1. `AGENTS.md` — highest authority
2. `.agents/skills/` — domain rules
3. Project documentation — project-specific
4. Agent memory — lowest priority

When conflicts are detected: **stop, present to user, wait for resolution**.

## Anti-Patterns

- ❌ Persisting to a file nobody reads (including yourself)
- ❌ Only using memory when the finding is universal
- ❌ Only using files when the finding is agent-specific
- ❌ Skipping root cause — fixing symptoms instead of causes
- ❌ Blaming the user
- ❌ Continuing without acknowledging the mistake

## References

- [ATTRIBUTION.md](references/ATTRIBUTION.md) — AI attribution headers for external posts
