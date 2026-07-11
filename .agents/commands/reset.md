---
description: Reset git state with mandatory checkpoint creation and user confirmation
argument-hint: <target>
---

Reset git state after creating safety checkpoint, analyzing impact, and waiting for explicit user confirmation.

**This command wraps the `git-reset` skill workflow.**

## Usage

```
/reset <target>
```

**Target can be:**
- **Commit hash**: `abc123` - Reset to specific commit
- **Relative reference**: `HEAD~3`, `HEAD^` - Reset relative to HEAD
- **Branch reference**: `origin/main` - Reset to branch
- **Reset type**: `--soft`, `--mixed`, `--hard` - Specify reset type (agent determines target)

The agent will:
1. **Analyze reset request** - Determine reset type and target
2. **Assess impact** - Calculate commits/changes to be lost
3. **Create checkpoint** - MANDATORY safety checkpoint (branch + stash)
4. **Inform user** - Present impact and checkpoint information
5. **Wait for confirmation** - NEVER proceeds without explicit "Yes"
6. **Execute reset** - Only after confirmation
7. **Verify result** - Confirm reset succeeded
8. **Report result** - Provide checkpoint location and restore instructions

## Reset Types

**Soft Reset (`--soft`):**
- Moves HEAD, keeps changes staged
- Non-destructive
- Use for: Redo commit message, combine commits

**Mixed Reset (`--mixed`, default):**
- Moves HEAD, unstages changes, keeps in working directory
- Partially destructive (staging lost)
- Use for: Unstage files, redo commits

**Hard Reset (`--hard`):**
- Moves HEAD, discards all changes
- **HIGHLY DESTRUCTIVE**
- Use for: Discard all work, match remote exactly

## Examples

**Reset to specific commit:**
```
/reset abc123
```

**Reset 3 commits back:**
```
/reset HEAD~3
```

**Reset to match remote:**
```
/reset origin/main
```

**Specify reset type:**
```
/reset --hard
/reset --soft HEAD~1
```

## Safety Guarantees

**Before any reset:**
- [ ] Checkpoint branch created: `checkpoint-reset-YYYYMMDD-HHMMSS`
- [ ] Stash created (for hard reset): `stash@{0}`
- [ ] Impact assessment presented to user
- [ ] Explicit user confirmation required
- [ ] Restore instructions provided

**NEVER:**
- Executes without checkpoint
- Proceeds without user confirmation
- Auto-confirms destructive operations
- Deletes checkpoints automatically

## Restore Instructions

**If you need to restore after reset:**

```bash
# Find checkpoint
git branch | grep checkpoint-reset

# Restore commits
git checkout <checkpoint-branch>

# Restore changes (if stashed)
git stash pop

# Or use reflog
git reflog
git reset --hard <commit-hash>
```

## Full Workflow

See `.agents/skills/git-reset/SKILL.md` for the complete workflow including:

- Reset type analysis and recommendation
- Impact assessment (commits, files, changes)
- Checkpoint creation (branch + stash)
- User confirmation workflow
- Execution and verification
- Restore procedures

## Precondition Rules

This command enforces:
- `.agents/rules/destructive-operations.md` - Checkpoint creation mandatory
- `.agents/rules/branch-workflow.md` - Branch safety

**Never executes destructive operations without checkpoints and confirmation.**

## Related

- `.agents/skills/git-reset/SKILL.md` - Full workflow implementation
- `.agents/rules/destructive-operations.md` - Destructive operations rule
- `.agents/rules/branch-workflow.md` - Branch workflow enforcement
