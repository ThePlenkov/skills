---
name: skills
description: Install and manage agent skills using the `npx skills` CLI (vercel-labs/skills).
---

# skills CLI

The `npx skills` CLI ([vercel-labs/skills](https://github.com/vercel-labs/skills)) is the standard tool for installing and managing agent skills across all major coding agents.

## Install Skills

```bash
# Install all skills from this repo to all detected agents
npx skills add ThePlenkov/skills --all --full-depth

# Install to specific agents
npx skills add ThePlenkov/skills -a claude-code --full-depth

# Install specific skills only
npx skills add ThePlenkov/skills --skill dotagents --skill github

# List available skills without installing
npx skills add ThePlenkov/skills --list --full-depth

# Non-interactive (CI/CD)
npx skills add ThePlenkov/skills --all --full-depth -y
```

> **`--full-depth`**: Required when skills are organized in custom category
> subdirectories (e.g. `.agents/skills/cognitive/adhd/SKILL.md`). Without it,
> only depth-1 children of each search dir are discovered. Exception: the
> built-in prefixes `.system/`, `.curated/`, and `.experimental/` are always
> searched as priority dirs and do not need `--full-depth`.

## Source Formats

```bash
# GitHub shorthand
npx skills add owner/repo

# Full GitHub URL
npx skills add https://github.com/owner/repo

# Local path (current project)
npx skills add .
```

## Manage Installed Skills

```bash
# List all installed skills
npx skills list

# Check for updates
npx skills check

# Update all skills
npx skills update

# Remove a skill
npx skills remove <skill-name>

# Remove all skills
npx skills remove --all
```

## Agent Paths

| Agent | Project Path | Global Path |
|-------|-------------|-------------|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Windsurf | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` |
| Codex | `.agents/skills/` | `~/.codex/skills/` |
| Cursor | `.agents/skills/` | `~/.cursor/skills/` |

Use `-g` / `--global` to install to the global path instead of the project.

## Scope

```bash
# Project-scoped (default) — committed with the project, shared with the team
npx skills add ThePlenkov/skills -a claude-code

# Global — available across all projects
npx skills add ThePlenkov/skills -a claude-code -g
```
