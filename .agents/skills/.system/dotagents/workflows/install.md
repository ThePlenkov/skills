# /dotagents install

Install or update skills into the current agent's native format. Idempotent — safe to re-run.

## Skill Discovery

Scan the **current project** for skills to install:

1. **Local skills**: Find all `SKILL.md` files under `.agents/` in the current working directory
   ```bash
   find .agents -name "SKILL.md" -exec dirname {} \;
   ```

2. **Config-based skills** (optional): If `.agents/skills.json` exists in the project root, also install skills from the configured external sources

**Only install skills that belong to or are configured for this project.**

## Installation

The agent installs discovered skills in its **own native format**:

1. **Identify own format**: How does this agent consume skills? (symlinks, config files, inline references, etc.)
2. **Create agent directory**: `.{agent}/skills/` (or equivalent) if it doesn't exist
3. **Create references**: Use **relative symlinks** back to `.agents/` where possible, so the project stays portable
   ```bash
   ln -sf ../../.agents/skills/<category>/<skill> .{agent}/skills/<flat-name>
   ```
4. **Flatten names**: Convert deep paths to flat names (e.g., `.system/dotagents` → `system-dotagents`)
5. **Verify**: Confirm each skill's `SKILL.md` is reachable from the agent's perspective

## Principles

- The agent decides HOW to install — this workflow only says WHAT.
- Don't prescribe a single method — every agent is different.
- Prefer relative symlinks or references over copying (to stay in sync with updates).
- Don't overwrite existing configs without user approval.
- Never pull in skills from unrelated sources — scope is the current project.
