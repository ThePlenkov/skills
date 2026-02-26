---
name: dotagents
description: End-to-end lifecycle management for the .agents/ framework. Use for initializing agents, installing/updating skills, syncing across repos, and listing current setup.
version: "1.0"
compatibility: Sync script requires bash, jq, and find.
---

# dotagents

Manages the `.agents/` framework lifecycle — from bootstrapping a new agent to keeping skills synchronized across repositories.

## Commands

| Command | Purpose | Workflow |
|---------|---------|----------|
| `/dotagents init` | Bootstrap a new agent into the framework | [workflows/init.md](workflows/init.md) |
| `/dotagents install` | Install or update skills in an agent's native format | [workflows/install.md](workflows/install.md) |
| `/dotagents sync` | Synchronize skills from source repos into `~/.agents/skills/` | [workflows/sync.md](workflows/sync.md) |
| `/dotagents list` | Print current setup — skills, agents, config | [workflows/list.md](workflows/list.md) |

## What Are Skills?

Skills are **documentation for the LLM**, not shell script wrappers.

The LLM is intelligent enough to read `SKILL.md` and act. Skills provide context, not automation.

**Skills should NOT:**
- Wrap simple commands in shell scripts
- Duplicate logic across skills
- Create unnecessary abstraction layers

**Skills SHOULD:**
- Provide clear documentation
- List prerequisites
- Show exact commands the LLM should run
- Include troubleshooting guidance

### Skill Structure

```
skill-name/
├── SKILL.md           # Required: Documentation for LLM
├── references/        # Optional: Detailed reference docs
├── assets/            # Optional: Templates, boilerplate
├── agents/            # Optional: Agent-specific configs
└── scripts/           # Optional: Only for genuinely complex operations
```

See [assets/TEMPLATE.md](assets/TEMPLATE.md) for a skill template.

### Creating a New Skill

1. Decide scope: personal or work repository
2. Choose the appropriate category folder under `.agents/skills/`
3. Create `<skill-name>/SKILL.md` with YAML frontmatter (`name`, `description`)
4. Optional: add `references/`, `assets/`, or `scripts/`
5. Run `/dotagents sync` to refresh symlinks

## Subagents

When an agent supports subagents or delegation, use this hierarchy.

See [references/subagents.md](references/subagents.md) for roles, delegation rules, and task boundaries.

## References

- [references/subagents.md](references/subagents.md) — Agent hierarchy and delegation rules
- [references/naming-convention.md](references/naming-convention.md) — Flat symlink naming convention

## Assets

- [assets/TEMPLATE.md](assets/TEMPLATE.md) — Skill template
- [assets/skills.json.example](assets/skills.json.example) — Sync config template
