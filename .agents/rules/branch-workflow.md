# Branch Workflow Rule

## Overview
Agents must **never commit directly to main branch**. All work must be done on feature branches and submitted via pull requests. This prevents accidental pushes to main and ensures proper review workflow.

## Core Principle

**Main branch is protected. Always work on feature branches.**

## Workflow

### 1. Before Starting Any Work

**Always create a feature branch first:**

```bash
# Check current branch
git branch --show-current

# If on main, create feature branch
git checkout -b <branch-name>
```

**Branch naming conventions:**
- `feat/<description>` - New features
- `fix/<description>` - Bug fixes
- `docs/<description>` - Documentation changes
- `refactor/<description>` - Code refactoring
- `test/<description>` - Test additions/updates
- `chore/<description>` - Maintenance tasks

**Examples:**
```bash
git checkout -b feat/memory-migration
git checkout -b fix/broken-links
git checkout -b docs/commit-rules
git checkout -b refactor/api-cleanup
```

### 2. During Work

**All commits go to the feature branch:**
- Stage changes: `git add <files>`
- Commit: `git commit -m "message"`
- Push to feature branch: `git push origin <branch-name>`

**Never:**
- Commit directly to main
- Push to main without PR
- Force push to main (except in recovery scenarios)

### 3. After Work Completion

**Create pull request:**

```bash
# Push feature branch
git push origin <branch-name>

# Create PR
gh pr create --title "title" --body "description" --base main --head <branch-name>
```

**PR requirements:**
- Descriptive title following conventional commits format
- Summary of changes in body
- Reference related issues/tickets
- Ensure CI passes
- Request review if needed

### 4. After PR Merge

**Clean up:**

```bash
# Switch to main
git checkout main

# Pull latest
git pull origin main

# Delete feature branch
git branch -d <branch-name>
git push origin --delete <branch-name>
```

## Recovery from Accidental Main Commits

**If commits were made to main by mistake:**

1. **Create feature branch from before the commits:**
   ```bash
   git checkout -b feat/<description> <commit-before-changes>
   ```

2. **Cherry-pick the commits:**
   ```bash
   git cherry-pick <commit1> <commit2> <commit3>
   ```

3. **Reset main to origin:**
   ```bash
   git checkout main
   git reset --hard origin/main
   ```

4. **If already pushed to origin/main, force push reset:**
   ```bash
   git push origin main --force-with-lease
   ```

5. **Push feature branch and create PR:**
   ```bash
   git push origin feat/<description>
   gh pr create --title "title" --body "description"
   ```

## Enforcement

**Before any commit:**
- [ ] Verify current branch is NOT main: `git branch --show-current`
- [ ] If on main, create feature branch immediately
- [ ] Never use `git push origin main` directly

**Before any push:**
- [ ] Verify pushing to feature branch, not main
- [ ] Verify branch name follows conventions

**If on main branch:**
1. **Stop immediately**
2. Create feature branch
3. Continue work on feature branch

## Integration with Other Rules

This rule works with:
- `documentation.md` - Documentation updates in feature branches
- `project-structure.md` - Structure changes in feature branches
- `git-commit` skill - Commits go to feature branches

## Anti-Patterns

- Committing directly to main "just this once"
- Pushing to main without PR "because it's small"
- Working on main and creating branch later
- Force pushing to main without recovery reason
- Skipping PR for "trivial" changes

## Exceptions

### Only exception: Emergency hotfixes

If production is broken and immediate fix is needed:
1. Create hotfix branch: `git checkout -b hotfix/<description>`
2. Make minimal fix
3. Create PR with "HOTFIX" label
4. Merge immediately after CI passes
5. Never commit directly to main even for hotfixes

## Related Rules

- `documentation.md` - Documentation must be updated in feature branches
- `project-structure.md` - Structure changes in feature branches
- `git-commit` skill - Commit workflow applies to feature branches

## User Preference

**This user explicitly requires:**
- Never commit automatically
- Always wait for explicit `/commit` command
- Always work on feature branches, never main
- Full control over when commits and pushes happen
