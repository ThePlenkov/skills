---
description: Self-correction protocol - stop, understand, persist fix to prevent recurrence
---

When something goes wrong, stop and capture the learning to prevent recurrence.

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

Apply the full retrospect protocol from `~/.agents/skills/retrospect/SKILL.md`.
