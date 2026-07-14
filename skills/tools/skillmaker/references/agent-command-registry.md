# Agent Command Registry

Built-in commands reserved by major AI coding agents. Skill names MUST NOT
conflict with these — use `scripts/validate-reserved-names.sh` to check.

Source of truth for reserved names: `skills/tools/skillmaker/assets/agents/*.yaml`.
Regenerate: `./skills/tools/skillmaker/scripts/collect-reserved.sh`

## Claude Code

Source: https://code.claude.com/docs/en/commands (101 commands)

| Command | Type | Purpose |
|---------|------|---------|
| `/add-dir` | builtin | Add working directory for file access |
| `/advisor` | builtin | Enable/disable advisor tool (second model) |
| `/agents` | builtin | Manage subagent configurations |
| `/autofix-pr` | skill | Watch PR and push fixes on CI failure |
| `/background` | builtin | Detach session to background agent |
| `/batch` | skill | Parallel codebase changes across worktrees |
| `/branch` | builtin | Fork conversation branch |
| `/btw` | builtin | Quick side question |
| `/cd` | builtin | Move session to new working directory |
| `/chrome` | builtin | Configure Claude in Chrome |
| `/claude-api` | skill | Load Claude API reference / migrate |
| `/clear` | builtin | Start fresh conversation |
| `/code-review` | skill | Review diff for bugs and cleanups |
| `/color` | builtin | Set prompt bar color |
| `/compact` | builtin | Summarize conversation to free context |
| `/config` | builtin | Open settings interface |
| `/context` | builtin | Visualize context usage |
| `/copy` | builtin | Copy last response to clipboard |
| `/cost` | builtin | Alias for /usage |
| `/dataviz` | skill | Chart/dashboard design guidance |
| `/debug` | builtin | Enable debug logging |
| `/deep-research` | workflow | Fan out web searches, synthesize report |
| `/design-login` | builtin | Authorize design-system access |
| `/design-sync` | skill | Upload design system to Claude Design |
| `/desktop` | builtin | Continue in Desktop app |
| `/diff` | builtin | Open interactive diff viewer |
| `/doctor` | skill | Setup checkup and diagnostics |
| `/effort` | builtin | Set model effort level |
| `/exit` | builtin | Exit CLI |
| `/export` | builtin | Export conversation |
| `/fast` | builtin | Toggle fast mode |
| `/feedback` | builtin | Submit feedback / report bug |
| `/fewer-permission-prompts` | skill | Reduce permission prompts |
| `/focus` | builtin | Toggle focus view |
| `/fork` | builtin | Spawn forked subagent |
| `/goal` | builtin | Set persistent goal |
| `/heapdump` | builtin | Write JS heap snapshot |
| `/help` | builtin | Show help |
| `/hooks` | builtin | View hook configurations |
| `/ide` | builtin | Manage IDE integrations |
| `/init` | builtin | Generate starter CLAUDE.md |
| `/insights` | builtin | Usage insights |
| `/install-github-app` | builtin | Install GitHub app |
| `/install-slack-app` | builtin | Install Slack app |
| `/keybindings` | builtin | Manage keybindings |
| `/login` | builtin | Log in |
| `/logout` | builtin | Log out |
| `/loop` | builtin | Repeat command on interval |
| `/mcp` | builtin | Manage MCP servers |
| `/memory` | builtin | Edit CLAUDE.md memory file |
| `/mobile` | builtin | Mobile integration |
| `/model` | builtin | Switch model |
| `/passes` | builtin | Session passes |
| `/permissions` | builtin | Manage permission rules |
| `/plan` | builtin | Switch to plan mode |
| `/plugin` | builtin | Manage plugins |
| `/powerup` | builtin | Power-up features |
| `/pr-comments` | builtin | View PR comments |
| `/privacy-settings` | builtin | Privacy settings |
| `/radio` | builtin | Radio mode |
| `/recap` | builtin | Session recap |
| `/release-notes` | builtin | Show release notes |
| `/reload-plugins` | builtin | Reload plugins |
| `/reload-skills` | builtin | Reload skills |
| `/remote-control` | builtin | Remote control from other device |
| `/remote-env` | builtin | Remote environment |
| `/rename` | builtin | Rename session |
| `/resume` | builtin | Resume previous conversation |
| `/review` | builtin | Single-pass PR review |
| `/rewind` | builtin | Roll back to checkpoint |
| `/run` | builtin | Run command |
| `/run-skill-generator` | builtin | Run skill generator |
| `/sandbox` | builtin | Sandbox mode |
| `/schedule` | builtin | Schedule tasks |
| `/scroll-speed` | builtin | Set scroll speed |
| `/security-review` | builtin | Security vulnerability review |
| `/setup-bedrock` | builtin | Setup Amazon Bedrock |
| `/setup-vertex` | builtin | Setup Google Vertex |
| `/simplify` | builtin | Cleanup-only review |
| `/skills` | builtin | Manage skills |
| `/stats` | builtin | Session statistics |
| `/status` | builtin | Session status |
| `/statusline` | builtin | Configure status line |
| `/stickers` | builtin | Stickers |
| `/stop` | builtin | Stop current operation |
| `/tasks` | builtin | List background tasks |
| `/team-onboarding` | builtin | Team onboarding |
| `/teleport` | builtin | Pull web session to terminal |
| `/terminal-setup` | builtin | Terminal setup |
| `/theme` | builtin | Set theme |
| `/tui` | builtin | TUI settings |
| `/ultraplan` | builtin | Ultra planning mode |
| `/ultrareview` | builtin | Deep cloud review |
| `/upgrade` | builtin | Upgrade plan |
| `/usage` | builtin | Show usage |
| `/usage-credits` | builtin | Show usage credits |
| `/verify` | builtin | Verify changes |
| `/vim` | builtin | Toggle vim mode |
| `/voice` | builtin | Voice input |
| `/web-setup` | builtin | Web setup |
| `/workflows` | builtin | Manage workflows |

## Kilo (opencode)

Kilo uses skills loaded from `.kilo/skills/<name>/` and `.agents/skills/<name>/`.
No built-in slash commands beyond standard agent tool invocation.

## Cursor

Uses `.cursorrules` and `.cursor/skills/` for skill loading.
No documented built-in slash command namespace.

## Windsurf (Codeium)

Uses `.windsurf/skills/` and `.windsurf/rules` for skill/rule loading.
No documented built-in slash command namespace.

## Aider

Uses `/ask`, `/code`, `/chat` as primary commands in interactive mode.
URL: https://aider.chat/docs/usage.html

## Copilot (GitHub)

Uses `@workspace`, `@terminal`, `@vscode` as context prefixes.
No slash-command skill system.

---

## Reserved Name Policy

All agent built-in command names are reserved for this repository.
The install script (`scripts/install.sh`) and CI validation
(`scripts/validate-reserved-names.sh`) enforce this automatically.

To add a new agent's commands:
1. Add `skills/tools/skillmaker/assets/agents/<agent>.yaml`
2. Run `./skills/tools/skillmaker/scripts/collect-reserved.sh`
3. Update this registry document
