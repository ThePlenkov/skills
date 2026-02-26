---
name: skill-sync
description: Synchronize skills from multiple source repositories into a flat ~/.agents/skills/ directory. Use when setting up a new machine, adding skill sources, or refreshing symlinks after skill changes.
metadata:
  author: pplenkov
  version: "1.0"
compatibility: Requires bash, jq, and find. Works on Linux and macOS.
allowed-tools: Bash(jq:*) Bash(find:*) Bash(ln:*) Bash(rm:*) Read
---

# Skill Sync

Aggregates skills from multiple source repositories into a single flat `~/.agents/skills/` directory using symlinks. This makes all skills accessible to any agent (Codex, Cascade, Claude, etc.) regardless of how deeply nested they are in their source repos.

## How It Works

1. Reads `~/.agents/skills.json` for source repository mappings
2. Scans each source for `SKILL.md` files under `.agents/skills/`
3. Creates flat symlinks in `~/.agents/skills/` using a prefix-based naming convention
4. Cleans up stale symlinks

## Prerequisites

- `jq` must be installed (`apt install jq` or `brew install jq`)
- Source repositories must be cloned locally
- `~/.agents/skills.json` must exist (see [Setup](#setup))

## Setup

### 1. Create the config file

```bash
cat > ~/.agents/skills.json << 'EOF'
{
  "target": "~/.agents/skills",
  "sources": {
    "personal": "/path/to/personal-skills",
    "work": "/path/to/work-skills",
    "example": "/path/to/example-skills"
  }
}
EOF
```

See [assets/skills.json.example](assets/skills.json.example) for a template.

### 2. Run the sync

```bash
bash ~/.agents/skills/skill-sync/scripts/sync.sh
```

Or if this skill is not yet synced, run it from the repo directly:

```bash
bash /path/to/skills-personal/.agents/skills/skill-sync/scripts/sync.sh
```

## Naming Convention

Skills are flattened into the target directory using this pattern:

```
{source-prefix}-{relative-path-with-slashes-as-hyphens}
```

See [references/naming-convention.md](references/naming-convention.md) for full details and examples.

### Examples

| Source | Skill Location | Symlink Name |
|--------|---------------|--------------|
| `personal` | `.agents/skills/.system/skill-sync/SKILL.md` | `personal-system-skill-sync` |
| `personal` | `.agents/skills/integrations/github/SKILL.md` | `personal-integrations-github` |
| `personal` | `.agents/skills/methodology/change-management/git-commit/SKILL.md` | `personal-methodology-change-management-git-commit` |
| `work` | `.agents/skills/bk/SKILL.md` | `work-bk` |

Dot-prefixed directories (e.g., `.system`) have their leading dot stripped (→ `system`).

## Sync Behavior

- **Idempotent**: Safe to run multiple times
- **Symlinks only**: Only removes/creates symlinks, never touches regular files or directories
- **Dry-run mode**: Pass `--dry-run` to preview changes without applying them
- **Verbose mode**: Pass `--verbose` to see detailed output

```bash
# Preview what would happen
bash scripts/sync.sh --dry-run

# Full output
bash scripts/sync.sh --verbose
```

## Troubleshooting

- **`jq: command not found`** — Install jq: `apt install jq` or `brew install jq`
- **`skills.json not found`** — Create `~/.agents/skills.json` (see Setup above)
- **Broken symlinks** — Re-run sync; stale symlinks are cleaned automatically
- **Name collision** — Two skills from different sources resolve to the same flat name. Rename one of them or adjust the source prefix in `skills.json`
