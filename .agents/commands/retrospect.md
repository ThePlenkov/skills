---
description: Self-correction protocol - stop, understand, persist fix, and route drill prevention plans to the right resource
---

When something goes wrong or a drill returns a `prevention_plan`, stop and capture the learning to prevent recurrence.

**Protocol:**

1. **STOP** - Stop current approach immediately, acknowledge mistake

2. **UNDERSTAND**
   - What went wrong? (describe precisely)
   - Why? (missing context, wrong assumption, ignored conventions)
   - Is this a pattern? (happened before?)

3. **DETERMINE SCOPE**
   - Universal (all agents, all projects) → Update AGENTS.md or .agents/skills/
   - Project (this codebase) → Update project docs, README, config
   - Agent (this agent's behavior) → Agent memory, tool-specific rules
   - Session (one-off, won't recur) → Mental note, no persistence

4. **PERSIST THE FIX**
   Choose mechanism based on scope:
   - Skill update (improves skill instructions)
   - AGENTS.md (universal project rule)
   - Agent memory (agent-specific context)
   - Code comments (implementation-level)
   - Project docs (project-specific knowledge)

   Fix must be where agent will encounter it before making same mistake.

5. **APPLY NOW** - Apply learning to current task immediately

**Drill-driven retrospection:**
- Run this protocol once after the root `/undrill` returns and the topmost parent has merged the `prevention_plan` from the whole drill tree.
- Route each action by `sink`:
  - `backlog` → `$skill{backlog}` (record the root drill as the source)
  - `memory` → classify as user or project memory per step 3b in the full protocol (`skills/self-learning/retrospect/SKILL.md`), then use `$skill{persistent-memory}` with the selected scope
  - `knowledgebase` → knowledge notes
  - `agentic-documents` → `AGENTS.md`, `.agents/commands/`, `.agents/rules/`, or project docs. If the target is a specific skill's `SKILL.md`, use `$skill{skill-feedback}` to route to its canonical `source:` repository instead of editing a generated copy.
  - `upstream-issue` → open an issue in the relevant repo; do not submit a PR unless the drill explicitly included it
  - `workaround` / `code` → implement and link to the drill
- If an action is out of scope or permissions, document it in the backlog and flag to the user

**Authority hierarchy (when rules conflict):**
1. AGENTS.md (highest)
2. .agents/skills/ (domain rules)
3. Project documentation
4. Agent memory (lowest)

**Never:**
- Persist to file nobody reads
- Only use memory when finding is universal
- Only use files when finding is agent-specific
- Skip root cause analysis
- Blame the user
- Continue without acknowledging mistake
- Ignore a drill `prevention_plan`

Apply the full retrospect protocol from `skills/self-learning/retrospect/SKILL.md`.
