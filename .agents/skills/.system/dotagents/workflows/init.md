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
Run `/dotagents install` to set up skills in own native format.

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

Scan the **current project** for skills:

1. **Local skills**: Find all `SKILL.md` files under `.agents/` in the current working directory
   ```bash
   find .agents -name "SKILL.md" -exec dirname {} \;
   ```

2. **Config-based skills** (optional): If `.agents/skills.json` exists, also install skills from the configured external sources

The key rule: **only install skills that belong to or are configured for this project**. Never pull in unrelated skills from other sources.

### 3. Create the Agent Directory

Create `.{agent}/` in the project root if it doesn't exist:
```bash
mkdir -p .{agent}/
```

### 4. Install Skills for the Target Agent

Based on research, create skill references in the target agent's native format. Use **relative symlinks** pointing back to `.agents/` so the project stays portable:

```bash
# Example for an agent that uses symlinks:
ln -sf ../../.agents/skills/<category>/<skill> .{agent}/skills/<flat-name>
```

### 5. Configure Subagents (if supported)

If the target agent supports subagents, configure delegation per `references/subagents.md`.

### 6. Verify

- [ ] Target agent directory exists with correct structure
- [ ] Skills are linked/referenced in the target agent's native format
- [ ] Only project-relevant skills are installed (no leaking from other repos)
- [ ] No existing configs were overwritten without user approval

---

## Principles

- **Research first, act second**: Always search for the target agent's current documentation before creating files.
- **Non-destructive**: Don't overwrite existing tool configs without user approval.
- **Idempotent**: Safe to re-run after updates.
- **Agent-specific**: Every agent is different. Don't apply one agent's conventions to another.
