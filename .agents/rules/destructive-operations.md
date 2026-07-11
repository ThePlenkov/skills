# Destructive Operations Rule

## Overview
Agents must **never perform destructive operations without creating checkpoints first**. Destructive operations include any action that may lead to data loss: git resets, file deletions, database operations, force pushes, etc. This rule enforces safety mechanisms to prevent accidental data loss.

## Core Principle

**Before any destructive operation: Create checkpoint. After verification: Proceed. If mistake: Restore.**

## What Counts as Destructive

### Git Operations
- `git reset --hard` - Discards uncommitted changes
- `git reset --mixed` - Unstages changes
- `git clean -fd` - Deletes untracked files
- `git push --force` - Overwrites remote history
- `git branch -D` - Force deletes branch
- `git rebase` - Rewrites history
- `git filter-branch` - Rewrites history
- `git reflog expire` - Removes reflog entries

### File Operations
- `rm -rf` - Recursive deletion
- `mv` - Moving files (potential overwrite)
- Overwriting files without backup
- Truncating files
- Clearing directories

### Database Operations
- `DROP TABLE` - Deletes table
- `TRUNCATE` - Clears table data
- `DELETE FROM` - Removes rows
- `UPDATE` - Modifies data
- Schema migrations (irreversible)

### Build/Deployment Operations
- Clearing build caches
- Deleting node_modules/vendor
- Purging Docker volumes
- Removing deployment artifacts

## Checkpoint Strategies

### Git Checkpoints

**Before git reset/clean:**
```bash
# Create checkpoint branch
git branch checkpoint-$(date +%Y%m%d-%H%M%S)

# Or create stash
git stash push -u -m "checkpoint before reset"

# Or use worktree
git worktree add ../checkpoint-worktree
```

**Before force push:**
```bash
# Create backup branch
git branch backup-$(date +%Y%m%d-%H%M%S)

# Or tag the commit
git tag backup-$(date +%Y%m%d-%H%M%S)
```

### File Checkpoints

**Before file deletion:**
```bash
# Create backup directory
mkdir -p .backups/$(date +%Y%m%d-%H%M%S)
cp -r <files-to-delete> .backups/$(date +%Y%m%d-%H%M%S)/

# Or use git (if tracked)
git add <files-to-delete>
git stash push -m "backup before deletion"
```

**Before file overwrite:**
```bash
# Create backup with timestamp
cp <file> <file>.backup-$(date +%Y%m%d-%H%M%S)
```

### Database Checkpoints

**Before database operations:**
```bash
# Create database backup
pg_dump <database> > backup-$(date +%Y%m%d-%H%M%S).sql

# Or create snapshot (if supported)
# Or use transactions with rollback capability
```

### Worktree Checkpoints

**For complex operations:**
```bash
# Create worktree for safe experimentation
git worktree add ../experiment-worktree

# Work in worktree
cd ../experiment-worktree
# ... perform operations ...

# If successful, merge back
cd ../main-worktree
git merge experiment-worktree

# If failed, delete worktree
git worktree remove ../experiment-worktree
```

## Workflow

### 1. Identify Destructive Operation

**Before any operation, ask:**
- Will this delete data?
- Will this overwrite data?
- Can this be undone easily?
- Is there a non-destructive alternative?

**If answer is "yes" to any, it's destructive.**

### 2. Create Checkpoint

**Choose appropriate checkpoint strategy:**
- Git operations → Git checkpoint (branch/stash/tag)
- File operations → File backup (copy to .backups/)
- Database operations → Database backup (dump/snapshot)
- Complex operations → Worktree checkpoint

**Verify checkpoint created:**
```bash
# For git branch
git branch | grep checkpoint

# For stash
git stash list

# For file backup
ls -la .backups/

# For worktree
git worktree list
```

### 3. Inform User

**Before proceeding, inform user:**
- What operation will be performed
- What data may be lost
- What checkpoint was created
- How to restore if needed

**Example:**
```
⚠️ Destructive Operation Detected

Operation: git reset --hard HEAD~3
Impact: Will discard last 3 commits and all uncommitted changes
Checkpoint: Created branch 'checkpoint-20260711-142530'
Restore: git checkout checkpoint-20260711-142530

Proceed? (Waiting for confirmation)
```

### 4. Wait for Confirmation

**Never proceed automatically with destructive operations.**

Use `ask_followup_question` to get explicit user confirmation:
```xml
<ask_followup_question>
<question>⚠️ This will discard uncommitted changes. Checkpoint created at 'checkpoint-20260711-142530'. Proceed with git reset --hard?</question>
<follow_up>
<suggest>Yes, proceed</suggest>
<suggest>No, cancel</suggest>
<suggest>Show me the checkpoint first</suggest>
</follow_up>
</ask_followup_question>
```

### 5. Execute Operation

**Only after explicit confirmation:**
- Execute the destructive operation
- Verify success
- Report result
- Remind user of checkpoint location

### 6. Verify Result

**After operation:**
- Check if operation succeeded
- Verify expected state
- Test if system still works
- Document what was done

### 7. Clean Up Checkpoints (Optional)

**After verification:**
- Keep checkpoint for safety period (e.g., 7 days)
- User can manually delete when confident
- Never auto-delete checkpoints

## Enforcement

**Before any destructive operation:**
- [ ] Operation identified as destructive
- [ ] Checkpoint created and verified
- [ ] User informed of impact and checkpoint
- [ ] Explicit user confirmation received
- [ ] Operation executed
- [ ] Result verified
- [ ] Checkpoint location reported

**Never:**
- Execute destructive operations without checkpoints
- Auto-confirm destructive operations
- Delete checkpoints automatically
- Assume user wants to proceed
- Skip verification steps

## Skills and Commands

**Destructive operations must:**
- Be implemented in dedicated skills (not inline in commands)
- Include checkpoint creation in workflow
- Require explicit user confirmation
- Provide restore instructions
- Never contain destructive scripts directly

**Example structure:**
```markdown
# Skill: git-reset

## Workflow

1. Identify reset type and impact
2. Create checkpoint (branch/stash)
3. Inform user and wait for confirmation
4. Execute reset
5. Verify result
6. Report checkpoint location

## Restore Instructions

If mistake:
- git checkout <checkpoint-branch>
- git stash pop (if stashed)
```

## Anti-Patterns

- Executing `git reset --hard` without checkpoint
- Deleting files without backup
- Force pushing without backup branch
- Auto-confirming destructive operations
- Putting destructive scripts in skill files
- Assuming "smart agent" won't make mistakes
- Skipping user confirmation
- Auto-deleting checkpoints

## Integration with Other Rules

This rule works with:
- `branch-workflow.md` - Feature branch safety
- `git-commit` skill - Commit before destructive ops
- `git-push` skill - Backup before force push

## Recovery Procedures

### Git Reset Recovery

```bash
# Find checkpoint
git branch | grep checkpoint

# Restore from checkpoint
git checkout <checkpoint-branch>

# Or restore from stash
git stash list
git stash pop stash@{0}

# Or use reflog
git reflog
git reset --hard <commit-hash>
```

### File Deletion Recovery

```bash
# Find backup
ls -la .backups/

# Restore files
cp -r .backups/<timestamp>/* .

# Or restore from git (if tracked)
git checkout HEAD -- <file>
```

### Database Recovery

```bash
# Restore from backup
psql <database> < backup-<timestamp>.sql

# Or rollback transaction (if in transaction)
ROLLBACK;
```

## Related Rules and Skills

- `.agents/skills/git-reset/SKILL.md` - Git reset with checkpoints
- `.agents/rules/branch-workflow.md` - Branch safety
- `.agents/skills/git-push/SKILL.md` - Force push safety

## Notes

- Always create checkpoints before destructive operations
- Never auto-confirm destructive operations
- Keep checkpoints for safety period
- Provide clear restore instructions
- Even "smart agents" can make mistakes - safety first
- Never put destructive scripts directly in skills/commands
