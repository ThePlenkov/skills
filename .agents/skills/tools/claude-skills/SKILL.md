---
name: claude-skills
description: Scans ~/.agents/skills for nested skill directories and creates flat symlinks in ~/.claude/skills for Claude Code.
---

# Claude Skills Manager

Scans `~/.agents/skills` for nested skill directories and creates flat symlinks in `~/.claude/skills` to make them accessible to Claude Code.

## Usage

```bash
/claude-skills [--dry-run] [--clean]
```

## Options

- `--dry-run`: Show what would be done without making changes
- `--clean`: Remove existing skill symlinks before creating new ones

## How it works

1. Recursively scans `~/.agents/skills` for directories containing `SKILL.md`
2. For each found skill:
   - Generates a unique flat name (e.g., `github`, `atlassian`, etc.)
   - Creates a symlink in `~/.claude/skills/` pointing to the nested skill directory
3. Skips the `claude-skills` skill itself to avoid recursion

## Examples

```bash
# Preview what would be done
/claude-skills --dry-run

# Clean and recreate all skill symlinks
/claude-skills --clean

# Create symlinks for newly added skills
/claude-skills
```
