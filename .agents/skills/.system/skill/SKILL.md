---
name: skill
description: Skill discovery and management. Use when creating, listing, or understanding the skill system.
version: "1.0"
---

# Skill System

Skills are **documentation for the LLM**, not shell script wrappers.

## Philosophy

The LLM is intelligent enough to:
- Read SKILL.md and understand what to do
- Run commands directly (curl, docker-compose, etc.)
- Handle errors and adapt

**Skills should NOT:**
- Wrap simple commands in shell scripts
- Duplicate logic across skills
- Create unnecessary abstraction layers

**Skills SHOULD:**
- Provide clear documentation
- List prerequisites (other skills that must be set up first)
- Show exact commands the LLM should run
- Include troubleshooting guidance

## Skill Structure

```
skill-name/
├── SKILL.md           # Required: Documentation for LLM
├── references/        # Optional: Detailed reference docs
├── assets/            # Optional: Templates, boilerplate
├── agents/            # Optional: Agent-specific configs (openai.yaml, etc.)
└── scripts/           # Optional: Only for genuinely complex operations
    └── complex-op.sh  # e.g., SSO token fetching, multi-step setup
```

## Skill Locations

Skills are aggregated in `~/.agents/skills/` from multiple sources:

| Source | Repo | Content |
|--------|------|---------|
| Personal | `skills-personal` (GitHub) | Generic, reusable skills |
| Work | `skills-booking` (GitLab) | Work-specific skills |

Skills are synced into `~/.agents/skills/` using the `skill-sync` skill, which reads
`~/.agents/skills.json` and creates flat, prefixed symlinks (e.g., `personal-git-commit`).

Run `$skill-sync` to set up or refresh the symlinks.

## Discovering Skills

```bash
# List all active skills
ls ~/.agents/skills/

# Read a skill
cat ~/.agents/skills/<skill-name>/SKILL.md
```

## Creating New Skills

1. Decide scope: personal (GitHub) or work (GitLab)
2. Create `<skill-name>/SKILL.md` in the appropriate repo under `.agents/skills/`
3. Add YAML frontmatter: `name`, `description`, optional `version` and `prerequisites`
4. Run `$skill-sync` to refresh symlinks in `~/.agents/skills/`
5. Add scripts **only** if operation is genuinely complex

## Installing Skills to Project Agents

Symlink `~/.agents/skills` (or individual skills) into project agent dirs:

```bash
# Symlink entire skills dir
ln -sf ~/.agents/skills .windsurf/skills
ln -sf ~/.agents/skills .claude/skills
ln -sf ~/.agents/skills .codex/skills
```
