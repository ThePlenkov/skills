---
name: skill-tiers
description: Skill activation tiers and the 300-line always-on budget. Defines Tier 0 (always-on), Tier 1 (on-task-start via /recall), and Tier 2 (on-demand). Load when deciding which skills to activate or when designing a new skill.
---

# Skill Tiers

> **Always-on budget: all Tier 0 skills combined ≤ 300 lines.** Tier 0 is paid on every interaction; everything else is opt-in.

## Why tiers exist

Loading a skill into agent context costs tokens on **every** invocation. A 100-line skill loaded always costs ~2,000 tokens of context per request — for tasks where that skill is irrelevant. Multiple "always-on" skills compound into tens of thousands of wasted tokens before any task-specific work begins.

Tiers cap that cost and make activation explicit.

---

## Tier 0 — always-on (budget: 300 lines total)

Loaded into context for every interaction without the agent opting in.

**Approved Tier 0 candidates** (must each justify the always-on cost):

- `$skill{token-rationalism}` — governs how the agent spends tokens on every response
- (future candidates must displace or share the 300-line budget)

**Rules**:

- Total Tier 0 line count must stay ≤ 300. Verify with `wc -l` on every Tier 0 `SKILL.md`.
- Move detailed examples, recipes, and edge cases to `references/` — only essential rules live in the main `SKILL.md`.
- New Tier 0 skills must displace an existing one or fit in the remaining budget.
- Tier and triggers are defined centrally in `skills.config.ts`; set `tier: 0` and `triggers: [always]` there.

---

## Tier 1 — on-task-start

Loaded by the agent (or user) when a task begins, when cross-session context may matter.

**Approved Tier 1 candidates**:

- `$skill{persistent-memory}` — load via `/recall <terms>` at task start when prior context, decisions, or retrospect findings are relevant

**Rules**:

- Tier and triggers are defined centrally in `skills.config.ts`; set `tier: 1` and `triggers: [user]` there (NOT `always`).
- `$skill{persistent-memory}` for Tier 1 protocol