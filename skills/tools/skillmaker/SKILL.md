---
name: skillmaker
description: Create, validate, and manage agent skills. Generates SKILL.md scaffolds, checks reserved names, validates frontmatter against schema, and helps rename conflicting skills.
---

# Skillmaker

Toolkit for creating and validating agent skills.

## When to use

- Creating a new skill → scaffold + validate
- Skill name conflicts → check reserved names + rename
- CI failures on skill validation → diagnose + fix
- Adding a new agent → add YAML to `assets/agents/`

## Before creating: reuse check

Before scaffolding a new skill, run `reuse-first` against the proposed skill's domain. Search for:

- Skills with overlapping scope (same category, similar description)
- Skills already cross-referenced from the same Tier 0 rule
- Any existing procedure in the same category that this could extend

If a sibling exists, decide explicitly one of:

1. **Merge into the existing skill** — if your skill is a strict subset
2. **Extend the existing skill** — if you have a section to add, not a whole skill
3. **Cross-reference from the existing skill** — if you have a different angle
4. **Genuinely new** — if no overlap; document the gap this fills

Document the decision in the new skill's `## Cross-references` section when one is created, or in the surviving/extended skill's `## Cross-references` (or the change plan) when no new skill is created. This is the `reuse-first` principle applied to skill creation itself — the same principle that prevents code duplication prevents skill duplication.

Failure mode this prevents: agents creating new skills that overlap with existing ones, inflating the skill registry with near-duplicates that fragment the agent's behavior across inconsistent procedures.

## Create a new skill

```bash
npx tsx scripts/run.ts .agents/skills/skillmaker/scripts/skill-scaffold.sh <category> <name>
```

Creates `skills/<category>/<name>/SKILL.md` and `skills/<category>/<name>/agents/openai.yaml` with valid templates.
After creation, run `npm run install:skills` to update the links.

## Validate reserved names

```bash
npx tsx scripts/run.ts scripts/validate-reserved-names.sh
```

Checks all skills against the reserved names list. Run after creating or renaming any skill.

## Add a new agent

1. Create `skills/tools/skillmaker/assets/agents/<agent-name>.yaml`
2. List reserved commands under `commands:` (one per line, `- /command-name`)
3. Run `npx tsx scripts/run.ts .agents/skills/skillmaker/scripts/collect-reserved.sh` to regenerate `scripts/reserved-names.sh`
4. Add a per-agent reference file to `references/agents/<agent-name>.md`
5. Update `references/agent-command-registry.md` to link to it

### Agent YAML format

```yaml
agent: my-agent
source: https://docs.my-agent.com/commands
commands:
  - /command-one
  - /command-two
```

## Regenerate reserved names

After editing any `assets/agents/*.yaml`:

```bash
npx tsx scripts/run.ts .agents/skills/skillmaker/scripts/collect-reserved.sh
```

This regenerates `scripts/reserved-names.sh` (single source of truth for all scripts).

## Naming Rules

- Use kebab-case: `my-skill-name`
- Pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`
- Must not match any entry in the reserved names list
- Must be unique across all categories (no duplicate basenames)

## SKILL.md Frontmatter

The `SKILL.md` frontmatter now contains only the canonical `name` and `description`. Runtime metadata such as `tier`, `triggers`, `source`, `allowed-tools`, `conflicts_with`, `depends_on`, and `disable-model-invocation` are defined centrally in [`skills.config.ts`](../../../skills.config.ts).

```yaml
---
name: my-skill-name
description: "One-sentence description (10-500 chars)"
---
```

You may also include optional `metadata` for tags, author, version, or upstream notes:

```yaml
---
name: my-skill-name
description: "One-sentence description (10-500 chars)"
metadata:
  version: "1.0.0"
  author: "you"
---
```

`skillmaker` scaffolds both the `SKILL.md` and a default entry in `skills.config.ts` with `tier: 2` and `triggers: [user, model]`. It omits `source` for the canonical `theplenkov-ai/skills` repo and only writes it for forks or external skills. Update `skills.config.ts` to add `allowed-tools`, `conflicts_with`, `depends_on`, or `disable-model-invocation` as needed. For Codex, also create `agents/openai.yaml` with:

```yaml
policy:
  allow_implicit_invocation: false
```

## File Structure

```
skills/tools/skillmaker/
  SKILL.md
  assets/
    agents/                  # per-agent reserved command lists (one YAML per agent)
      claude-code.yaml
      aider.yaml
      ...                    # additional agent YAMLs
  scripts/
    collect-reserved.sh      # aggregate YAMLs → reserved-names.sh
    skill-scaffold.sh        # create new skill from template
  references/
    agent-command-registry.md  # index linking to per-agent reference files
    agents/                    # per-agent command reference files
```

## Craft layer

After scaffolding a new skill (or revising an existing one), the **human**
should invoke `writing-great-skills` to review the result against
the craft rules that make a skill predictable: invocation mode (model- vs.
user-invoked), the description (front-loaded leading word, one trigger
per branch, no duplication), the information hierarchy (steps vs.
reference, progressive disclosure to a linked file), the leading-word
technique, and the failure modes that the skill's body should defend
against. `skillmaker` is the **procedure** (how to scaffold);
`writing-great-skills` is the **craft** (how to make the result fire
reliably). Both are required for a skill that ages well.

**Why both user and model triggers**: `writing-great-skills` is invoked by
users (`user`) and can also be reached by agents (`model`,
`disable-model-invocation: false`), so it is available both when a human
explicitly asks for it and when an agent is scoping a skill. If your agent
is running `skillmaker` autonomously, schedule a human review pass before the
scaffolded skill is merged.

## Related skills

See [related-skills.md](references/related-skills.md) for the full cross-reference list.
