---
name: claude-skills
description: Install or refresh skills for Claude Code using `npx skills add`. Use when setting up Claude Code for the first time or after adding new skills to the repository.
---

# Claude Skills Manager

Installs skills from this repository into Claude Code using the [`npx skills` CLI](https://github.com/vercel-labs/skills).

## Install skills for Claude Code

```bash
# Install all skills from this repo to Claude Code (project-scoped)
npx skills add ThePlenkov/skills -a claude-code

# Install all skills globally (available across all projects)
npx skills add ThePlenkov/skills -a claude-code -g

# Install from a local clone
npx skills add . -a claude-code

# Non-interactive
npx skills add ThePlenkov/skills -a claude-code -y
```

## List available skills

```bash
npx skills add ThePlenkov/skills --list
```

## Update skills

```bash
npx skills update
```

## Notes

- Skills are installed to `.claude/skills/` (project) or `~/.claude/skills/` (global).
- Re-running the install command is safe and idempotent.
