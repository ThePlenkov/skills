---
name: git-reset
description: "Reset git state with mandatory $skill{safeguard} preservation and approval. Analyzes reset type, assesses impact, delegates checkpoint and confirmation to safeguard, and provides restore instructions. Never executes destructive operations without user approval."
source: ThePlenkov/skills
---

# Git Reset

## Overview

This skill provides git-reset-specific analysis, execution, and verification. Before any reset, use $skill{safeguard} for canonical preservation and approval requirements.

## Workflow

### 1. Analyze Reset Request

**Determine what type of reset is needed:**

```bash
# Check current state
git status
git log --oneline -10
git diff --stat
```

**Reset types:**

#### Soft Reset (`--soft`)
- Moves HEAD to target commit
- Keeps changes staged
- Non-destructive (changes preserved)
- Use case: Redo last commit message

#### Mixed Reset (`--mixed`, default)
- Moves HEAD to target commit
- Unstages changes
- Keeps changes in working directory
- Partially destructive (staging lost)
- Use case: Unstage files, redo commits

#### Hard Reset (`--hard`)
- Moves HEAD to target commit
- Discards all changes
- **HIGHLY DESTRUCTIVE**
- Use case: Discard all work, start fresh

**Determine target:**
- Commit hash: `abc123`
- Relative: `HEAD~3`, `HEAD^`
- Branch: `origin/main`

### 2. Assess Impact

**Calculate what will be lost:**

```bash
# Show commits to be removed
git log <target>..HEAD --oneline

# Show changes to be discarded (for --hard)
git diff <target> --stat

# Show staged changes (for --mixed/--hard)
git diff --cached --stat

# Show unstaged changes (for --hard)
git diff --stat
```

**Impact assessment:**
- Number of commits to remove
- Number of files affected
- Staged changes count
- Unstaged changes count
- Untracked files (if using with `git clean`)

### 3. Preserve State and Request Approval

Before any reset, load and follow `$skill{safeguard}`.

`$skill{safeguard}` is the canonical protocol for destructive operations. It inspects repository state, creates a checkpoint of all at-risk work, and requests explicit user approval.

- Use the impact assessment from Step 2 to explain what is at risk.
- Do not create a separate checkpoint branch or stash here.
- Do not ask for approval outside of `$skill{safeguard}`.
- Only proceed after `$skill{safeguard}` reports explicit approval.

### 4. Execute Reset

**Only after `$skill{safeguard}` has completed and explicit approval has been received:**

```bash
git reset <--soft|--mixed|--hard> <target>
```

**DO NOT include this command in the skill file as a script.**

**Agent must construct and execute the command after confirmation.**

### 5. Verify Result

**After reset, verify:**

```bash
# Check new HEAD position
git log --oneline -5

# Check working directory state
git status
```

**Verification checklist:**
- [ ] HEAD moved to target commit
- [ ] Working directory in expected state
- [ ] `$skill{safeguard}` checkpoint was created and retained

### 6. Report Result

**Report to user:**
- Reset completed successfully
- New HEAD position
- `$skill{safeguard}` checkpoint path
- Restore instructions from `$skill{safeguard}`
- Next steps (if any)

**Example:**
```
✅ Git Reset Completed

Reset Type: hard
New HEAD: abc123 "feat: add new feature"

Checkpoint Preserved:
- Path: <CHECKPOINT_DIR> (created by $skill{safeguard})

To restore if needed:
- Follow the restore instructions in $skill{safeguard}.
- Use `git reflog` for commit-level recovery if needed.

Checkpoint will be kept for your safety. Delete manually when confident.
```

## Reset Type Selection

**Agent should recommend appropriate reset type:**

**Use `--soft` when:**
- User wants to redo commit message
- User wants to combine commits
- Changes should remain staged

**Use `--mixed` when:**
- User wants to unstage files
- User wants to redo commits but keep changes
- Default safe option

**Use `--hard` when:**
- User explicitly wants to discard all changes
- User wants to match remote exactly
- User confirms understanding of data loss

**Always prefer less destructive options when possible.**

## Restore Instructions

**If the reset needs to be undone or files need to be recovered, use the `$skill{safeguard}` checkpoint first.**

### Restore from Safeguard Checkpoint

1. Locate the checkpoint directory and git checkpoint branch reported by `$skill{safeguard}`.
2. Follow the restore procedure in `$skill{safeguard}`.

### Git-Level Recovery

If you need to recover commits or undo the reset itself:

```bash
# Find the previous HEAD in the reflog
git reflog

# Reset back to a known-good commit
git reset --hard <commit-hash>
```

```bash
# Restore a specific file from a previous commit
git checkout <commit-hash> -- <file-path>
```

## Integration with Other Rules

This skill enforces:
- Destructive-operation preservation and approval — see $skill{safeguard}
- Branch workflow rules — see `.agents/rules/branch-workflow.md`

## Anti-Patterns

- Executing reset without checkpoint
- Auto-confirming destructive operations
- Using `--hard` as default
- Deleting checkpoints immediately
- Not informing user of impact
- Including destructive scripts in skill file

## Related Skills and Commands

- Destructive-operation safety — see $skill{safeguard}
- Branch workflow — see `.agents/rules/branch-workflow.md`
- $skill{git-push} - Force push safety

## Notes

- Always use `$skill{safeguard}` before reset
- Always wait for explicit user confirmation from `$skill{safeguard}`
- Never auto-confirm destructive operations
- Keep checkpoints for safety period
- Prefer less destructive reset types
- Never include destructive scripts in skill file
- Agent constructs and executes commands after confirmation
