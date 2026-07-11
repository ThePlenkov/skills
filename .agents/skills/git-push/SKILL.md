---
name: git-push
description: Push commits to remote with validation of target and scope. Analyzes target to determine if it's a branch, PR, external project, fork, or submodule. Enforces branch workflow rules and prevents accidental pushes to protected branches.
---

# Git Push

## Workflow

### 1. Analyze Push Target

**Determine what the target represents:**

```bash
# Check current branch
git branch --show-current

# Check remotes
git remote -v

# Check if target is a branch
git branch -a | grep <target>

# Check if target is a PR number
gh pr view <target> 2>/dev/null

# Check if target is a remote
git remote | grep <target>
```

**Target types:**

#### Branch Name
- Local branch: `feat/my-feature`
- Remote branch: `origin/feat/my-feature`
- Push to same-named remote branch

#### PR Number
- Format: `#123` or `123`
- Push to PR's head branch
- Update existing PR

#### Remote Name
- Format: `origin`, `upstream`, `fork`
- Push current branch to remote
- Useful for forks and multiple remotes

#### External Project/Fork
- Format: `username/repo` or `https://github.com/username/repo`
- Add as temporary remote
- Push to external repository
- Useful for contributing to forks

#### Submodule
- Format: `submodules/<name>` or path to submodule
- Push submodule changes
- Update parent repository reference

#### No Target (Default)
- Push current branch to tracked remote
- Use upstream tracking if set
- Default to `origin/<current-branch>`

### 2. Validate Current Branch

**Before pushing**, verify the current branch:

```bash
git branch --show-current
```

**Branch validation:**
- [ ] **NOT on main/master** - Never push directly to protected branches
- [ ] **Feature branch exists** - Branch follows naming conventions
- [ ] **Branch is up to date** - No conflicts with remote

**If on main/master:**
1. **STOP immediately**
2. Follow recovery procedure from `.agents/rules/branch-workflow.md`
3. Create feature branch
4. Cherry-pick commits
5. Reset main to origin
6. Push feature branch instead

### 3. Resolve Target to Remote and Branch

**Based on target type, determine:**
- Remote name (e.g., `origin`, `upstream`, `fork`)
- Branch name (e.g., `feat/my-feature`)
- Push refspec (e.g., `HEAD:refs/heads/feat/my-feature`)

**Examples:**

**Branch name:**
```bash
# Target: feat/my-feature
# Resolved: origin/feat/my-feature
git push origin feat/my-feature
```

**PR number:**
```bash
# Target: #123
# Resolved: origin/<pr-head-branch>
pr_branch=$(gh pr view 123 --json headRefName -q .headRefName)
git push origin HEAD:$pr_branch
```

**Remote name:**
```bash
# Target: upstream
# Resolved: upstream/<current-branch>
current_branch=$(git branch --show-current)
git push upstream $current_branch
```

**External project:**
```bash
# Target: username/repo
# Add temporary remote
git remote add temp-push https://github.com/username/repo
git push temp-push <current-branch>
git remote remove temp-push
```

**Submodule:**
```bash
# Target: submodules/my-submodule
cd submodules/my-submodule
git push origin HEAD
cd ../..
git add submodules/my-submodule
git commit -m "chore: update submodule reference"
```

### 4. Validate Push Target

**Target validation:**
- [ ] **Remote exists or can be created** - Valid remote URL
- [ ] **Branch name valid** - Follows naming conventions
- [ ] **Protected branches blocked** - Cannot push to main/master/develop
- [ ] **Permissions verified** - Have write access to target

**Protected branches** (never push directly):
- `main`
- `master`
- `develop`
- `production`
- `release/*`

### 5. Validate Commit Scope

**Review commits to be pushed:**

```bash
# Show commits not yet pushed
git log <remote>/<branch>..HEAD --oneline

# Show detailed diff
git diff <remote>/<branch>..HEAD --stat
```

**Scope validation:**
- [ ] **All commits follow conventions** - Conventional commits format
- [ ] **Documentation updated** - Per documentation.md rule
- [ ] **Structure maintained** - Per project-structure.md rule
- [ ] **No secrets or credentials** - Scan for sensitive data
- [ ] **No build artifacts** - Verify .gitignore respected

**Scan for secrets:**
```bash
# Check for common secret patterns
git diff <remote>/<branch>..HEAD | grep -iE '(password|secret|token|api[_-]?key|private[_-]?key)'

# Check for credential files
git diff <remote>/<branch>..HEAD --name-only | grep -E '(\.env|credentials|secrets)'
```

### 6. Determine Push Strategy

**Choose appropriate push strategy:**

#### First Push (New Branch)
```bash
git push -u <remote> <branch>
```

**When to use:**
- Branch doesn't exist on remote
- First time pushing feature branch
- Sets upstream tracking

#### Regular Push
```bash
git push <remote> <branch>
```

**When to use:**
- Branch already exists on remote
- Upstream tracking already set
- Normal workflow push

#### Force Push (Use with Caution)
```bash
git push <remote> <branch> --force-with-lease
```

**When to use:**
- Amended commits after feedback
- Rebased on latest main
- Fixed commit history

**NEVER use `--force` without `--lease`** - Always use `--force-with-lease` to prevent overwriting others' work.

**When NOT to force push:**
- Shared branches with multiple contributors
- After PR is created and reviewed
- Main/master/protected branches (blocked anyway)

### 7. Execute Push

**Push with appropriate strategy:**

```bash
# Determine if first push
if git rev-parse --verify <remote>/<branch> 2>/dev/null; then
  # Branch exists, regular push
  git push <remote> <branch>
else
  # New branch, set upstream
  git push -u <remote> <branch>
fi
```

### 8. Verify Push Success

**After push, verify:**

```bash
# Check remote branch
git ls-remote --heads <remote> <branch>

# Verify commits pushed
git log <remote>/<branch> --oneline -5
```

**Success criteria:**
- [ ] Remote branch updated
- [ ] All commits present on remote
- [ ] No errors or warnings
- [ ] Upstream tracking set (if first push)

### 9. Next Steps

**After successful push:**

**If PR doesn't exist:**
```bash
# Create PR
gh pr create --title "title" --body "description" --base main --head <branch>
```

**If PR exists (pushed to PR):**
```bash
# PR automatically updated
# Notify reviewers if needed
gh pr comment <pr-number> --body "Updated with latest changes"
```

**If pushed to fork/external:**
```bash
# Create PR from fork to upstream
gh pr create --repo <upstream-repo> --head <fork>:<branch> --base main
```

## Target Examples

**Push to current branch's remote:**
```
/push
```

**Push to specific branch:**
```
/push feat/my-feature
```

**Push to PR:**
```
/push #123
/push 123
```

**Push to different remote:**
```
/push upstream
/push fork
```

**Push to external project:**
```
/push username/repo
/push https://github.com/username/repo
```

**Push submodule:**
```
/push submodules/my-submodule
```

## Enforcement

**This workflow is mandatory for all pushes.**

Never:
- Push directly to main/master/protected branches
- Use `--force` without `--lease`
- Push without validating branch and scope
- Skip secret scanning
- Push build artifacts or credentials

## Integration with Other Rules

This skill works with:
- `.agents/rules/branch-workflow.md` - Feature branch enforcement
- `.agents/rules/documentation.md` - Documentation validation
- `.agents/rules/project-structure.md` - Structure validation
- `.agents/skills/git-commit/SKILL.md` - Commit validation

## Anti-Patterns

- Pushing to main "just this once"
- Using `--force` instead of `--force-with-lease`
- Pushing without reviewing commits
- Skipping secret scanning
- Force pushing shared branches
- Pushing before CI passes locally

## Recovery Scenarios

### Pushed to Wrong Branch

```bash
# Delete remote branch
git push <remote> --delete <wrong-branch>

# Push to correct branch
git push <remote> <correct-branch>
```

### Pushed Secrets

```bash
# Immediately delete remote branch
git push <remote> --delete <branch>

# Remove secrets from history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <file-with-secrets>" \
  --prune-empty --tag-name-filter cat -- --all

# Rotate compromised credentials
# Push cleaned branch
git push <remote> <branch>
```

### Pushed to Main by Mistake

Follow recovery procedure from `.agents/rules/branch-workflow.md`:
1. Create feature branch from before commits
2. Cherry-pick commits
3. Reset main to origin
4. Force push main reset
5. Push feature branch
6. Create PR

## Related Rules and Commands

- `.agents/rules/branch-workflow.md` - Branch workflow enforcement
- `.agents/commands/push.md` - Command wrapper for this skill
- `.agents/skills/git-commit/SKILL.md` - Commit workflow

## Notes

- Always validate before pushing
- Use `--force-with-lease` instead of `--force`
- Scan for secrets before pushing
- Never push directly to protected branches
- Create PR after first push
- Agent determines target type (branch, PR, remote, fork, submodule)