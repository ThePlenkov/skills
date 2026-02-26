# /dotagents sync

Synchronize skills from multiple source repositories into a single flat `~/.agents/skills/` directory using symlinks. This makes all skills accessible to any agent regardless of source.

## How It Works

1. Reads `~/.agents/skills.json` for source repository mappings
2. Scans each source for `SKILL.md` files under `.agents/skills/`
3. Creates flat symlinks in `~/.agents/skills/` using a prefix-based naming convention
4. Cleans up stale symlinks

## Setup

Create `~/.agents/skills.json` (see [../assets/skills.json.example](../assets/skills.json.example)):

```json
{
  "target": "~/.agents/skills",
  "sources": {
    "personal": "/path/to/skills-personal",
    "work": "/path/to/skills-work"
  }
}
```

## Run

```bash
bash scripts/sync.sh              # normal
bash scripts/sync.sh --dry-run    # preview changes
bash scripts/sync.sh --verbose    # detailed output
```

Or via the synced symlink:

```bash
bash ~/.agents/skills/personal-system-dotagents/scripts/sync.sh --verbose
```

## Naming Convention

`{source-prefix}-{relative-path}` with `/` replaced by `-` and leading dots stripped.

Example: `.system/dotagents` in `personal` repo → `personal-system-dotagents`

See [../references/naming-convention.md](../references/naming-convention.md) for full details.

## Behavior

- **Idempotent**: Safe to run multiple times
- **Symlinks only**: Only removes/creates symlinks, never touches regular files
- **Stale cleanup**: Removes symlinks pointing to non-existent targets

## Troubleshooting

- **`jq: command not found`** — Install jq: `apt install jq` or `brew install jq`
- **`skills.json not found`** — Create `~/.agents/skills.json` (see Setup)
- **Broken symlinks** — Re-run sync; stale symlinks are cleaned automatically
- **Name collision** — Two skills resolve to the same name. Rename one or adjust the source prefix
