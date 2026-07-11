---
description: Review and consolidate memory - update entities, detect patterns, clean up
---

Periodically review and consolidate memories to maintain quality.

**When to reflect:**
- End of significant task
- User explicitly requests reflection
- Pattern detected in retrospect findings
- Session end or task completion

**What to do:**
- Update existing entities rather than creating duplicates
- Delete outdated observations before adding replacements
- Detect patterns in retrospect findings (recurring mistakes)
- Cross-reference related entities with relations
- Clean up completed tasks and obsolete data

**Pattern detection:**
When persisting retrospect findings, check for similar prior findings.
If pattern emerges (same mistake recurring):
- Create relation: retrospect:X -- "recurring_pattern" --> retrospect:Y
- Add observation about the pattern
- Surface pattern to user

**Always:**
- Search before creating new entities
- Update rather than duplicate
- Delete obsolete before adding new
- Link related entities

Apply the reflection protocol from `~/.agents/skills/memory/SKILL.md`.
