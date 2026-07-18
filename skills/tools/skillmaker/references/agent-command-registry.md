# Agent Command Registry

Built-in commands reserved by major AI coding agents. Skill names MUST NOT
conflict with these — use `npx tsx scripts/run.ts scripts/validate-reserved-names.sh` to check.

Source of truth for reserved names: `skills/tools/skillmaker/assets/agents/*.yaml`.
Regenerate: `npx tsx scripts/run.ts .agents/skills/skillmaker/scripts/collect-reserved.sh`

Per-agent details are in [`references/agents/`](agents/).

| Agent | Source | Reserved slash commands |
|-------|--------|------------------------|
| [Claude Code](agents/claude-code.md) | <https://code.claude.com/docs/en/commands> | 103 |
| [Kilo Code (Kilo)](agents/kilo.md) | <https://kilo.ai/docs/cli> | 43 |
| [Cursor](agents/cursor.md) | <https://cursor.com/docs/cli/reference/slash-commands> | 43 |
| [Windsurf (Codeium)](agents/windsurf.md) | <https://docs.codeium.com/windsurf> | 0 |
| [Aider](agents/aider.md) | <https://aider.chat/docs/usage/commands.html> | 42 |
| [GitHub Copilot CLI](agents/copilot.md) | <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference> | 91 |
| [Devin CLI](agents/devin.md) | <https://docs.devin.ai/cli/extensibility/skills/overview> | 0 |
| [IBM Bob](agents/bob.md) | <https://bob.ibm.com/docs/ide/features/slash-commands> | 5 |
| [Docker Agent](agents/docker-agent.md) | <https://docs.docker.com/ai/docker-agent/features/skills/> | 0 |
| [OpenCode](agents/opencode.md) | <https://opencode.ai/docs/tui/> | 23 |
| [OpenAI Codex CLI](agents/codex.md) | <https://developers.openai.com/codex/cli/slash-commands> | 1 |
| [Google Antigravity CLI](agents/antigravity.md) | <https://antigravity.google/docs/cli-overview> | 0 |
| [Pi](agents/pi.md) | <https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/skills.md> | 1 |
| [Droid (Factory)](agents/droid.md) | <https://docs.factory.ai/reference/cli-reference> | 0 |
| [Amp](agents/amp.md) | <https://ampcode.com/manual> | 0 |
| [Zed](agents/zed.md) | <https://zed.dev/docs/ai/skills> | 1 |
| [Mastra Code](agents/mastracode.md) | <https://code.mastra.ai/> | 36 |
| [System (agent-agnostic)](agents/system.md) | `agent-agnostic system concepts` | 4 |
