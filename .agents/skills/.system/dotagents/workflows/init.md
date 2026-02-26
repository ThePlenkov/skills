# /dotagents init

Bootstrap a new AI agent into the `.agents/` framework. The agent drives its own onboarding.

## Protocol

### 1. Self-Identification

The agent must determine:
- **Who am I?** — model name, provider, version
- **What can I do?** — file access, command execution, web search, memory, MCP tools
- **What are my limits?** — context window, output length, tool restrictions, sandbox mode

### 2. Capability Discovery

Use web search (if available) to look up:
- Own documentation and changelog
- Known limitations and workarounds
- Native skill/plugin/extension formats
- Supported configuration files and conventions

### 3. Read the Framework

Read in order:
1. `AGENTS.md` — project-level rules (supreme authority)
2. `.agents/skills/` — available skills (start with `.system/dotagents/`)
3. Tool-specific directory if it exists (`.windsurf/`, `.claude/`, `.codex/`, etc.)

### 4. Install Skills

Run `/dotagents install` to set up skills in the agent's native format.
See [install.md](install.md).

### 5. Configure Subagents

If the agent supports subagents or delegation:
1. Read `references/subagents.md` for hierarchy and delegation rules
2. Configure subagent roles according to the agent's own mechanism
3. Verify delegation paths work

### 6. Verify

The agent should confirm:
- [ ] Can discover and read skills
- [ ] Respects `AGENTS.md` rules
- [ ] Skills are accessible in native format
- [ ] Subagents configured (if applicable)
- [ ] Memory/context initialized (if applicable)

## Principles

- **Agent-driven**: The agent makes decisions about HOW to integrate.
- **Self-aware**: The agent must know its own capabilities before acting.
- **Non-destructive**: Don't overwrite existing tool configs without user approval.
- **Idempotent**: Safe to re-run after updates.
