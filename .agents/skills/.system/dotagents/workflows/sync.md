# /dotagents sync

Synchronize skills from multiple source repositories into one or more target directories using symlinks.

## How It Works

1. Reads `~/.agents/skills.json` for source and target configuration
2. For each target, scans applicable sources for `SKILL.md` files
3. Creates symlinks in each target using the configured mode
4. Cleans up stale symlinks per target

## Config Schema

See [../assets/skills.json.example](../assets/skills.json.example) for a full example.

```json
{
  "sources": [
    { "prefix": "personal", "path": "/path/to/skills-personal" },
    { "prefix": "work", "path": "/path/to/skills-work", "include": ["bk/**"] }
  ],
  "targets": [
    { "path": "~/.agents/skills", "flat": true },
    { "path": "/path/to/project/.claude/skills", "flat": true, "sources": ["personal"] }
  ]
}
```

### Sources

| Field | Required | Description |
|-------|----------|-------------|
| `prefix` | yes | Short name used in flat link naming (e.g. `personal`) |
| `path` | yes | Root of the skills repo |
| `include` | no | Glob patterns relative to `.agents/skills/` — only matching skills are synced |

### Targets

| Field | Required | Description |
|-------|----------|-------------|
| `path` | yes | Destination directory (`~` is expanded) |
| `flat` | no | `true` (default): flat symlinks per skill. `false`: one symlink per source prefix pointing to the source's `.agents/skills/` dir |
| `name_style` | no | `prefix` (default): `{prefix}-{flat-path}`. `basename`: skill directory name only — must be unique across sources |
| `sources` | no | Array of source prefixes to include. Omit to include all sources |

## Run

```bash
bash scripts/sync.sh              # normal
bash scripts/sync.sh --dry-run    # preview changes
bash scripts/sync.sh --verbose    # detailed output
bash scripts/sync.sh --config PATH  # use alternate config
```

Or via the synced symlink:

```bash
bash ~/.agents/skills/personal-system-dotagents/scripts/sync.sh --verbose
```

## Flat Mode Naming

`{source-prefix}-{relative-path}` with `/` replaced by `-` and leading dots stripped.

Example: `.system/dotagents` in `personal` repo → `personal-system-dotagents`

See [../references/naming-convention.md](../references/naming-convention.md) for full details.

## Behavior

- **Idempotent**: Safe to run multiple times
- **Symlinks only**: Only removes/creates symlinks, never touches regular files
- **Stale cleanup**: Removes symlinks no longer in desired set, per target
- **Per-target isolation**: Each target is managed independently

## Troubleshooting

- **`jq: command not found`** — Install jq: `apt install jq` or `brew install jq`
- **`skills.json not found`** — Create `~/.agents/skills.json` (see Setup above)
- **`Unsupported legacy config format`** — Migrate from old `{target, sources: {}}` to new `{sources: [], targets: []}` schema
- **Broken symlinks** — Re-run sync; stale symlinks are cleaned automatically
- **Name collision** — Two skills resolve to the same name. Rename one or adjust the source prefix
