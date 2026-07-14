---
name: skillmaker
description: Create, validate, and manage agent skills. Generates SKILL.md scaffolds, checks reserved names, validates frontmatter against schema, and helps rename conflicting skills.
triggers:
  - user
  - model
allowed-tools:
  - read
  - write
  - edit
  - bash
  - grep
  - glob
---

# Skillmaker

Toolkit for creating and validating agent skills.

## When to use

- Creating a new skill → scaffold + validate
- Skill name conflicts → check reserved names + rename
- CI failures on skill validation → diagnose + fix
- Adding a new agent → add YAML to `assets/agents/`

## Create a new skill

```bash
./skills/tools/skillmaker/scripts/skill-scaffold.sh <category> <name>
```

Creates `skills/<category>/<name>/SKILL.md` with valid frontmatter template.
After creation, run `./scripts/install.sh` to generate the symlink.

## Validate reserved names

```bash
./scripts/validate-reserved-names.sh
```

Checks all skills against the reserved names list. Run after creating or renaming any skill.

## Add a new agent

1. Create `skills/tools/skillmaker/assets/agents/<agent-name>.yaml`
2. List reserved commands under `commands:` (one per line, `- /command-name`)
3. Run `./skills/tools/skillmaker/scripts/collect-reserved.sh` to regenerate `scripts/reserved-names.sh`
4. Update `references/agent-command-registry.md`

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
./skills/tools/skillmaker/scripts/collect-reserved.sh
```

This regenerates `scripts/reserved-names.sh` (single source of truth for all scripts).

## Naming Rules

- Use kebab-case: `my-skill-name`
- Pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`
- Must not match any entry in the reserved names list
- Must be unique across all categories (no duplicate basenames)

## SKILL.md Frontmatter

```yaml
---
name: my-skill-name
description: "One-sentence description (10-500 chars)"
version: "1.0.0"           # optional semver
triggers:                  # optional
  - user                   # user invokes explicitly
  - model                  # agent loads automatically
  - always                 # always loaded
allowed-tools:             # optional
  - read
  - bash
argument-hint: --fix       # optional, shown in /help
---
```

## File Structure

```
skills/tools/skillmaker/
  SKILL.md
  assets/
    agents/                  # per-agent reserved command lists
      claude-code.yaml
      aider.yaml
      copilot.yaml
      kilo.yaml
      cursor.yaml
      windsurf.yaml
  scripts/
    collect-reserved.sh      # aggregate YAMLs → reserved-names.sh
    skill-scaffold.sh        # create new skill from template
  references/
    agent-command-registry.md  # human-readable command registry
```
