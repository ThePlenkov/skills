# /dotagents init

Two modes:

- `/dotagents init` — **self-bootstrap**: the current agent sets itself up
- `/dotagents init <agent>` — **cross-agent onboarding**: the current agent sets up another agent (e.g., Cascade onboards Claude)

---

## Mode 1: Self-Bootstrap (`/dotagents init`)

The current agent bootstraps itself into the `.agents/` framework.

### 1. Self-Identification

- **Who am I?** — model name, provider, version
- **What can I do?** — file access, command execution, web search, memory, MCP tools
- **What are my limits?** — context window, output length, tool restrictions, sandbox mode

### 2. Read the Framework

1. `AGENTS.md` — project-level rules (supreme authority)
2. `.agents/skills/` — available skills (start with `.system/dotagents/`)
3. Own tool directory if it exists (`.windsurf/`, `.claude/`, `.codex/`, etc.)

### 3. Install Skills

Run `scripts/install.sh` to set up `.agents/skills/` symlinks, or use `/dotagents install` for other agents.

### 4. Configure Subagents

If subagents/delegation are supported, read `references/subagents.md` and configure.

### 5. Verify

- [ ] Can discover and read skills
- [ ] Respects `AGENTS.md` rules
- [ ] Skills accessible in native format
- [ ] Subagents configured (if applicable)

---

## Mode 2: Cross-Agent Onboarding (`/dotagents init <agent>`)

The current agent onboards a **different** agent. For example: you are Cascade, and the user says `/dotagents init claude` — you must set up Claude.

### 1. Research the Target Agent

Use web search to find:

- **Config format**: What files does the target agent read? (e.g., `.claude/skills/`, `.codex/instructions.md`, `.cursorrules`)
- **Skill format**: How does it consume skills? Symlinks? Inline markdown? YAML?
- **Directory conventions**: What is the expected directory structure?
- **Limitations**: What can't it do? (e.g., no symlink support, no subdirectory scanning)

**Don't guess** — always search first. Agent formats change between versions.

### 2. Discover Skills to Install

For `.agents` agents (Codex, Cursor), use the install script to set up symlinks:

```bash
bash scripts/install.sh
```

For other agents, use the [`npx skills` CLI](https://github.com/vercel-labs/skills):

```bash
# List available skills first
npx skills add . --list

# Install all skills to the target agent
npx skills add . -a <agent-name> -y
```

The key rule: **only install skills that belong to or are configured for this project**. Never pull in unrelated skills from other sources.

### 3. Install Skills for the Target Agent

For `.agents` agents, `scripts/install.sh` already creates the correct flat symlink structure.

For other agents, use the [`npx skills` CLI](https://github.com/vercel-labs/skills) to install skills in the target agent's native format:

```bash
# Install to a specific agent
npx skills add . -a <agent-name> -y

# Examples:
npx skills add . -a claude-code -y
npx skills add . -a windsurf -y
```

The CLI automatically creates the correct directory structure for each agent.

### 4. Configure Subagents (if supported)

If the target agent supports subagents, configure delegation per `references/subagents.md`.

### 5. Verify

- [ ] Target agent directory exists with correct structure
- [ ] Skills are installed in the target agent's native format
- [ ] Only project-relevant skills are installed (no leaking from other repos)
- [ ] No existing configs were overwritten without user approval

---

## Principles

- **Research first, act second**: Always search for the target agent's current documentation before creating files.
- **Non-destructive**: Don't overwrite existing tool configs without user approval.
- **Idempotent**: Safe to re-run after updates.
- **Agent-specific**: Every agent is different. Don't apply one agent's conventions to another.
