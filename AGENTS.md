# AGENTS.md

This repository is an agent-agnostic collection of skills.

## Conventions
- Skills live under `.agents/skills/`
- Each skill is a folder that contains a `SKILL.md` file at its root
- Additional assets for a skill (scripts, templates, references) should live inside that skill folder
- Keep skills self-contained: do not rely on agent-specific folders like `.codex/` or `.clade/`

## Suggested skill folder layout
```
.agents/skills/<skill-name>/
  SKILL.md
  references/
    *.md          (documentation, schemas, reference material)
  scripts/
    *.py, *.sh    (executable code for automation)
  assets/
    *             (templates, boilerplate, non-doc files)
```

## Skill Usage Protocol

### Discovery
Before starting work, identify relevant skills:
1. Check `.agents/skills/README.md` for available skills
2. Read the `description` field in each `SKILL.md` frontmatter
3. Load the full `SKILL.md` if the skill applies to your current task

### Retrospect Integration

The `retrospect` skill converts mistakes into durable guardrails stored in `.agents/skills/retrospect/references/LEARNINGS.md`.

#### Before Significant Actions
Before code changes, major decisions, or complex outputs:
1. Search `.agents/skills/retrospect/references/LEARNINGS.md` for keywords matching your task
2. Check if any learned guardrails apply to your current context
3. If a match exists, apply the "IF/THEN" rule

#### After Failures or Friction
When output has problems, user feedback indicates issues, or you detect mistakes:
1. Invoke the `retrospect` skill (or ask the coordinator to)
2. It will check prior learnings for repeat patterns (Step 0)
3. New learnings are recorded to `references/LEARNINGS.md` with severity tiers

**Severity Guide:**
| Level | Meaning | Action |
|-------|---------|--------|
| H | Harm/loss/critical miss | Escalate + prioritize learning |
| M | Rework/friction | Add to learnings + apply proactively |
| L | Minor inefficiency | Document + low priority |

This creates a **read-write feedback loop**: failures → searchable rules → prevention in future tasks.

## Index
- A human-readable index of skills should be kept in `.agents/skills/README.md`
