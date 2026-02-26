# /dotagents install

Install or update skills into an agent's native format. Idempotent — safe to re-run.

## How It Works

Each agent has its own way of consuming skills. The agent must choose the right approach based on its own capabilities.

| Agent | Native Format | Typical Approach |
|-------|--------------|------------------|
| Claude | `.claude/skills/` symlinks | Symlink skill dirs into `.claude/skills/` |
| Codex | `.codex/instructions.md` | Reference skills in instructions file |
| Windsurf/Cascade | `.windsurf/workflows/` | Create workflows that reference skills |
| Cursor | `.cursorrules`, `.cursor/` | Embed or reference in rules file |
| Cagent | Agent-specific config | Adapt to tool's conventions |

## Steps

1. **Ensure sync is current**: Run `/dotagents sync` first if skills may have changed
2. **Identify agent format**: Determine the agent's native skill/config format
3. **Create tool directory**: `.{toolname}/` if it doesn't exist
4. **Link or reference skills**: Using the agent's native mechanism
5. **Verify**: Confirm skills are accessible from within the agent

## Principles

- The agent decides HOW to install — this workflow only says WHAT.
- Don't prescribe a single method — every agent is different.
- Prefer symlinks or references over copying (to stay in sync with updates).
- Don't overwrite existing configs without user approval.
