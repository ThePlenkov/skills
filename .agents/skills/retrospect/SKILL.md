---
name: retrospect
description: Structured self-reflection to identify mistakes and convert them into durable guardrails. Use when asked to reflect, do a retrospective, capture lessons learned, or when output had problems that should not repeat. Stores learnings in references/LEARNINGS.md for future prevention.
---

# Retrospect

Analyze mistakes and create searchable guardrails that prevent repeat errors.

## Workflow

**0. Check Prior Learnings**
Search `references/LEARNINGS.md` for patterns matching current issues. Flag if this is a repeat of a previous learning. Include repeat context in the Issues section.

**1. Review Context**
Identify the user's goals and where responses diverged. Note setup context:
- **User setup**: preferences, constraints, environment, explicit/implicit requirements
- **Project setup**: repo structure, conventions, tools, policies
- **Agent setup**: configuration, limitations, tool availability

**2. Extract Issues (with Severity)**
List concrete mistakes, missed requirements, or process failures. Rate each:
- **H (High)**: Caused user harm, data loss, or fundamental requirement miss
- **M (Medium)**: Caused rework or friction but recoverable  
- **L (Low)**: Minor inefficiency or style issue

Tie each issue to its setup factor (user/project/agent).

**3. Derive Prevention Steps**
For each issue, create "IF [trigger], THEN [action]" guardrails. Include a one-line root cause hint. Prefer explicit, checkable conditions.

**4. Record to references/LEARNINGS.md**
Append entries in this format:
```
[YYYY-MM-DD] [H/M/L] [user|project|agent] IF <condition>, THEN <action>
```
If agent has memory tools available, also store in agent memory.

**5. Propose Config Updates (optional)**
Suggest changes to user setup, project setup, or agent setup that would prevent similar issues. Frame as optional recommendations, not blockers.

## Output Format

Use this structure for clarity:

```
## Issues
| # | Severity | Context | Issue | Root Cause |
|---|----------|---------|-------|------------|
| 1 | H/M/L | user/project/agent | [issue] | [hint] |

## Repeat Check
- [ ] New issue / [x] Repeat of: [previous learning reference]

## Prevention Steps
- IF [trigger], THEN [action]
- IF [trigger], THEN [action]

## Recorded To
- references/LEARNINGS.md: [entries added]
- Agent Memory: [if applicable]

## Config Updates (optional)
- [user|project|agent]: [recommendation]
```

**Tone**: Factual, self-accountable. Do not blame the user. Every issue should map to a concrete prevention step.
