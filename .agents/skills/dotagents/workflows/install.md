# /dotagents install

Workflow helper: install or refresh skill manifests from this repository
into the running agent's native configuration directory.

> **Explicit-user-action only.** This workflow never runs automatically.
> It is invoked only when the user types `/dotagents install` and always
> prompts for confirmation before modifying any file. The `npx skills`
> CLI is documented upstream at https://github.com/vercel-labs/skills.

## Install with `npx skills`

Use the [`npx skills` CLI](https://github.com/vercel-labs/skills) to install skills from the current project into your agent:

```bash
# Install all skills from this repo to all detected agents
npx skills add . --all -y

# Install to a specific agent
npx skills add . -a claude-code
npx skills add . -a windsurf

# List available skills first
npx skills add . --list
```

The CLI auto-detects which coding agents are installed. Skills are placed in the agent's standard path (e.g., `.claude/skills/`, `.windsurf/skills/`).

## Install from GitHub

```bash
# Install from the published repo (equivalent to installing from local)
npx skills add ThePlenkov/skills --all -y
```

## Agent Paths

| Agent | Project Path |
|-------|-------------|
| Claude Code | `.claude/skills/` |
| Windsurf | `.windsurf/skills/` |
| Codex | `.agents/skills/` |
| Cursor | `.agents/skills/` |

## Principles

- Prefer the documented `npx skills` CLI for installation.
- Never replace an existing manifest without explicit user confirmation.
- Stay within the current project's repository boundary.
- Confirm with the user before any file change; this workflow never runs unattended.
