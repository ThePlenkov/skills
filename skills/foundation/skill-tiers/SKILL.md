---
name: skill-tiers
description: Skill activation tiers and the 300-line always-on budget. Defines Tier 0 (always-on), Tier 1 (on-task-start via /recall), and Tier 2 (on-demand). Load when deciding which skills to activate or when designing a new skill.
metadata:
  tier: 2
  triggers:
    - user
    - model
  source: theplenkov-ai/skills
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
- The frontmatter `metadata` MUST include `tier: 0` and `triggers: [always]` (the schema requires an array).

---

## Tier 1 — on-task-start

Loaded by the agent (or user) when a task begins, when cross-session context may matter.

**Approved Tier 1 candidates**:

- `$skill{persistent-memory}` — load via `/recall <terms>` at task start when prior context, decisions, or retrospect findings are relevant

**Rules**:

- The frontmatter `metadata` MUST include `tier: 1` and `triggers: [user]` (NOT `always`; the schema requires an array).
- Do not auto-load for trivial tasks (single-line edits, typo fixes, quick questions).
- Pair with a slash command (e.g. `/recall`, `/retain`, `/reflect`) for explicit invocation.

---

## Tier 2 — on-demand

Loaded only when the task description matches the skill's `description` metadata.

**Approved Tier 2 candidates** (not exhaustive):

- `$skill{adhd}` — load when user requests focus/coaching mode or signals drift
- `$skill{evidence}` — load when a completion claim may be made
- `$skill{investigate-first}` — load before any edit on an unfamiliar area
- `$skill{minimal-root-cause}` — load before patching suspected overengineering
- `$skill{codehome}` — load before any edit (verify right architectural home)
- `$skill{critical-thinking}` — load when evaluating ideas or plans
- `$skill{one-shot-patch}` — load when an isolated fix is known
- `$skill{triage-issue}`, `$skill{github-pr-review}`, etc. — load when their domain applies

**Rules**:

- The frontmatter `metadata` MUST include `tier: 2` and `triggers: [user, model]` (the schema requires an array; a single-element `triggers: [user]` is also valid).
- Never use `triggers: always` from Tier 2.
- No line-count budget — Tier 2 skills may be long because they are paid only when relevant.

---

## Tier rules summary

| Property | Tier 0 | Tier 1 | Tier 2 |
|---|---|---|---|
| Auto-loaded | Yes | No | No |
| Trigger | `always` | `user` (via `/recall` etc.) | `user`, `model` |
| Budget | ≤ 300 lines total | none | none |
| Activation | implicit | explicit command | task match |
| `metadata` | `tier: 0` | `tier: 1` | `tier: 2` |

---

## Adding a new skill

1. Decide its tier. Default to Tier 2.
2. Only promote to Tier 0 if the skill governs behavior on **every** interaction and the 300-line budget allows.
3. Only promote to Tier 1 if it should fire at task start and there is a slash command for opt-in.
4. Set `tier` and `triggers` in the frontmatter `metadata` block.
5. For Tier 0: extract long examples to `references/`. Keep the main `SKILL.md` lean.

---

## Verification

```bash
# Run the Tier 0 budget check used in CI
npx --yes tsx scripts/run.ts scripts/check-tier-0-budget.cjs
```

---

## Reference

- Issue #39: enforce max 300-line budget for always-on skills
- `$skill{token-rationalism}` for why tier 0 budget matters
- `$skill{persistent-memory}` for Tier 1 protocol