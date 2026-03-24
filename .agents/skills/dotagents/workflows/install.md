# /dotagents install

Install or update skills into the current agent's native format using `npx skills add`. Idempotent — safe to re-run.

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

- Use `npx skills` as the standard install tool.
- Don't overwrite existing configs without user approval.
- Never pull in skills from unrelated sources — scope is the current project.
