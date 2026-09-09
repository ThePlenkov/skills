# /dotagents install

Workflow helper: install or refresh skill manifests from this repository
into the running agent's native configuration directory.

> **Explicit-user-action only.** This workflow never runs automatically.
> It is invoked only when the user types `/dotagents install` and always
> prompts for confirmation before modifying any file. The `npx skills`
> CLI is documented upstream at https://github.com/vercel-labs/skills.

## Install `.agents/skills` symlinks

For `.agents` agents (Codex, Cursor), install or refresh skills as flat symlinks:

```bash
# Create .agents/skills/<skill-name> symlinks in the repo
npm run install:skills

# Preview changes
npm run install:skills -- --dry-run
```

This avoids the `npx skills` CLI, which copies files instead of symlinking.

## Install with `npx skills` (Claude Code, Windsurf)

Use the [`npx skills` CLI](https://github.com/vercel-labs/skills) to install skills from this repository into other agents:

```bash
# Install all skills from this repo to all detected agents
npx skills add ThePlenkov/skills --all -y

# Install to a specific agent from the local clone
npx skills add . -a claude-code
npx skills add . -a windsurf

# List available skills first
npx skills add . --list
```

The CLI auto-detects which coding agents are installed. Skills are placed in the agent's standard path (e.g., `.claude/skills/`, `.windsurf/skills/`).

## Agent Paths

| Agent | Project Path |
|-------|-------------|
| Claude Code | `.claude/skills/` |
| Windsurf | `.windsurf/skills/` |
| Codex | `.agents/skills/` |
| Cursor | `.agents/skills/` |

## Principles

- Use `npm run install:skills` for `.agents` agents (links) and `npx skills` for other agents.
- Never replace an existing manifest without explicit user confirmation.
- Stay within the current project's repository boundary.
- Confirm with the user before any file change; this workflow never runs unattended.
