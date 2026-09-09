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
- For reproducible or automated installs, add the `skills` CLI as a `devDependency` and invoke `npx skills` from a project with a locked `package-lock.json` instead of `npx -y` against the registry.
- Pin `npx` to a known version or use `--no`/`--offline` when the CLI supports it to avoid supply-chain surprises from unpinned dynamic resolution.
