# Naming Convention

## Pattern

```
{source-prefix}-{relative-path}
```

Where:
- **source-prefix**: The key from `skills.json` `sources` object (e.g., `personal`, `work`)
- **relative-path**: Path from `.agents/skills/` to the skill directory, with `/` replaced by `-` and leading dots stripped from path segments

## Algorithm

1. Start with the source prefix from `skills.json` (e.g., `personal`)
2. Find each `SKILL.md` file under `{source_repo}/.agents/skills/`
3. Take the parent directory of `SKILL.md`
4. Compute the relative path from `.agents/skills/` to that parent directory
5. Strip leading dots from path segments (e.g., `.system` → `system`)
6. Replace all `/` with `-`
7. Concatenate: `{prefix}-{flattened-path}`

## Examples

### System skill (dot-prefixed directory)

```
Source repo: /mnt/wsl/workspace/ubuntu/skills-personal
Skill file:  .agents/skills/.system/skill-sync/SKILL.md
Prefix:      personal
Relative:    .system/skill-sync  →  system/skill-sync
Result:      personal-system-skill-sync
```

### Integration skill

```
Source repo: /mnt/wsl/workspace/ubuntu/skills-personal
Skill file:  .agents/skills/integrations/github/SKILL.md
Prefix:      personal
Relative:    integrations/github
Result:      personal-integrations-github
```

### Methodology skill (deeply nested)

```
Source repo: /mnt/wsl/workspace/ubuntu/skills-personal
Skill file:  .agents/skills/methodology/change-management/git-commit/SKILL.md
Prefix:      personal
Relative:    methodology/change-management/git-commit
Result:      personal-methodology-change-management-git-commit
```

### Work skill

```
Source repo: /mnt/wsl/workspace/ubuntu/skills-booking
Skill file:  .agents/skills/bk/SKILL.md
Prefix:      work
Relative:    bk
Result:      work-bk
```

## Spec Compatibility

The generated names follow the [Agent Skills specification](https://agentskills.io/specification) naming rules:
- Lowercase alphanumeric and hyphens only
- No leading/trailing hyphens
- No consecutive hyphens

The `name` field inside `SKILL.md` remains the original skill name (e.g., `git-commit`). The symlink directory name in `~/.agents/skills/` uses the prefixed name for deconfliction across sources.
