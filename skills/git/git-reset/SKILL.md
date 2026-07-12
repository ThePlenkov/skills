---
name: git-reset
description: Reset git state with mandatory checkpoint creation. Analyzes reset type, creates safety checkpoint, waits for confirmation, and provides restore instructions. Never executes destructive operations without user approval.
---

# Git Reset

## Overview

This skill performs git reset operations with mandatory safety checkpoints per `.agents/rules/destructive-operations.md`. All destructive operations require explicit user confirmation.

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

### 3. Create Checkpoint

**MANDATORY: Create checkpoint before any reset.**

**For soft/mixed reset:**
```bash
# Create checkpoint branch
git branch checkpoint-reset-$(date +%Y%m%d-%H%M%S)
```

**For hard reset:**
```bash
# Create checkpoint branch
git branch checkpoint-reset-$(date +%Y%m%d-%H%M%S)

# Also create stash for uncommitted changes
git stash push -u -m "checkpoint before hard reset at $(date)"
```

**Verify checkpoint:**
```bash
# Verify branch created
git branch | grep checkpoint-reset

# Verify stash created (if applicable)
git stash list
```

### 4. Inform User and Wait for Confirmation

**Present impact and checkpoint information:**

```
⚠️ Destructive Operation: Git Reset

Reset Type: <soft|mixed|hard>
Target: <commit-hash or reference>

Impact:
- Commits to remove: <count>
- Files affected: <count>
- Staged changes: <will be kept|will be unstaged|will be discarded>
- Unstaged changes: <will be kept|will be discarded>

Checkpoint Created:
- Branch: checkpoint-reset-20260711-143045
- Stash: stash@{0} "checkpoint before hard reset" (if applicable)

Restore Instructions:
- Restore commits: git checkout checkpoint-reset-20260711-143045
- Restore changes: git stash pop (if stashed)

Proceed with reset?
```

**Use ask_followup_question for confirmation:**

```xml
<ask_followup_question>
<question>⚠️ This will <describe impact>. Checkpoint created. Proceed with git reset?</question>
<follow_up>
<suggest>Yes, proceed</suggest>
<suggest>No, cancel</suggest>
<suggest>Show me the checkpoint first</suggest>
<suggest>Use different reset type</suggest>
</follow_up>
</ask_followup_question>
```

**NEVER proceed without explicit "Yes" confirmation.**

### 5. Execute Reset

**Only after explicit user confirmation:**

```bash
# Execute the reset
git reset <--soft|--mixed|--hard> <target>
```

**DO NOT include this command in the skill file as a script.**
**Agent must construct and execute the command after confirmation.**

### 6. Verify Result

**After reset, verify:**

```bash
# Check new HEAD position
git log --oneline -5

# Check working directory state
git status

# Verify checkpoint still exists
git branch | grep checkpoint-reset
```

**Verification checklist:**
- [ ] HEAD moved to target commit
- [ ] Working directory in expected state
- [ ] Checkpoint branch exists
- [ ] Stash exists (if created)

### 7. Report Result

**Report to user:**
- Reset completed successfully
- New HEAD position
- Checkpoint location
- Restore instructions
- Next steps (if any)

**Example:**
```
✅ Git Reset Completed

Reset Type: hard
New HEAD: abc123 "feat: add new feature"

Checkpoint Preserved:
- Branch: checkpoint-reset-20260711-143045
- Stash: stash@{0} (if applicable)

To restore if needed:
- git checkout checkpoint-reset-20260711-143045
- git stash pop (if stashed)

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

**If user needs to restore after reset:**

### Restore Commits
```bash
# Find checkpoint
git branch | grep checkpoint-reset

# Restore from checkpoint
git checkout <checkpoint-branch>

# Or cherry-pick specific commits
git cherry-pick <commit-hash>
```

### Restore Changes
```bash
# Restore from stash
git stash list
git stash pop stash@{0}

# Or use reflog
git reflog
git reset --hard <commit-hash>
```

### Restore Files
```bash
# Restore specific file from checkpoint
git checkout <checkpoint-branch> -- <file-path>
```

## Integration with Other Rules

This skill enforces:
- Destructive operations rules — see `.agents/rules/destructive-operations.md`
- Branch workflow rules — see `.agents/rules/branch-workflow.md`

## Anti-Patterns

- Executing reset without checkpoint
- Auto-confirming destructive operations
- Using `--hard` as default
- Deleting checkpoints immediately
- Not informing user of impact
- Including destructive scripts in skill file

## Related Skills and Commands

- Destructive operations rule — see `.agents/rules/destructive-operations.md`
- Branch workflow — see `.agents/rules/branch-workflow.md`
- `.agents/skills/git-push/SKILL.md` - Force push safety

## Notes

- Always create checkpoint before reset
- Always wait for explicit user confirmation
- Never auto-confirm destructive operations
- Keep checkpoints for safety period
- Prefer less destructive reset types
- Never include destructive scripts in skill file
- Agent constructs and executes commands after confirmation
