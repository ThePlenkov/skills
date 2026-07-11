---
description: Generate self-contained handoff for next agent in subagent-driven PR pipeline
---

Generate a durable handoff between subagent-driven PRs for external agents with fresh context.

**When to use:**
- End of every subagent task, before opening PR
- Project structured as N PRs, each landing subagent work
- Next agent must continue without conversation context

**Workflow:**

1. **Inspect current state**
   - Check main HEAD, recent PRs, existing handoffs
   - Review lessons-learned.md

2. **Write handoff doc** (`docs/handoff/YYYY-MM-DD-subagent-NN-complete.md`)
   - TL;DR table (merged PRs: #, title, SHA, date)
   - Next task (single line for next agent)
   - State (main branch, repo shape, test count)
   - CI state (which gates green/red)
   - What landed in just-merged PR
   - New patterns discovered
   - Rules from lessons-learned.md
   - Operational contract (PATCHER → VERIFIER → REVIEWER loop)
   - Plan for next subagent
   - File history (prior handoff docs)

3. **Update lessons-learned.md** (if new patterns found)
   - Add new rule with: why it matters, patterns, concrete hit

4. **Create branch** for next subagent
   ```bash
   git checkout -b task/NN-task-name origin/main
   ```

5. **Add RED-phase test scaffold**
   - Write failing tests per contract
   - Verify RED state

6. **Commit + push + open draft PR**
   ```bash
   git commit -m "docs: add subagent-NN handoff + lessons; scaffold RED tests"
   gh pr create --draft
   ```

7. **Output next-agent prompt** (80-120 lines)
   - Repo/PR URLs, branch, SHA
   - Git checkout instructions
   - Docs to read, contract, rules
   - Exact loop and verification commands
   - Constraints and CI caveats

**Output must be self-contained** - new agent in new sandbox can start from handoff doc alone.

Apply the full pr-handoff protocol from `~/.agents/skills/pr-handoff/SKILL.md`.
