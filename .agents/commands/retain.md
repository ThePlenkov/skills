---
description: Persist significant learnings and findings immediately
argument-hint: <what-to-remember>
---

Persist significant findings to memory immediately - don't batch to end of session.

**What to persist:**
- Project knowledge (build commands, architecture decisions)
- User preferences (code style, tool choices)
- Retrospect findings (mistakes, root causes, prevention rules)
- Task context (what was done, what's left, blockers)
- Tool/library knowledge (quirks, workarounds)
- Decisions (why X over Y, trade-offs)

**Entity types:**
- `project` - Project-specific knowledge
- `user_preference` - User preferences
- `retrospect` - Mistakes and learnings
- `task` - Task context
- `tool` - Tool/library knowledge
- `decision` - Decision rationale

**Observation format:**
Keep atomic and actionable - one fact per observation.
Good: "Build requires Node 20+, fails silently on Node 18"
Bad: "The build system is complex..."

**Always:**
- Search before creating (update existing entities)
- Delete outdated observations before adding new ones
- Never store secrets or credentials
- Persist immediately when learning occurs

Apply the persist protocol from `.agents/skills/persistent-memory/SKILL.md`.
