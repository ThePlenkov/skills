---
name: git-push
description: Push commits to remote with validation of target and scope. Analyzes target to determine if it's a branch, PR, external project, fork, or submodule. Enforces branch workflow rules and prevents accidental pushes to protected branches. Supports --check flag to run CI checks locally and --fix flag to auto-fix issues before pushing.
source: ThePlenkov/skills
---

# Git Push

Push commits to remote with target validation, scope review, optional CI checks, and optional auto-fix.

## Workflow

### 1. Analyze push target

Determine the target type (branch, PR, remote, fork, submodule, default). Detection commands and resolution templates: [references/target-resolution.md](references/target-resolution.md).

### 2. Local CI checks (if `--check` or `--fix`)

If `--check` or `--fix`: invoke `$skill{ci-local}` first. On failure: abort unless `--fix` was passed. On success: proceed.

### 3. Auto-fix (if `--fix`)

Attempt auto-fix per `$skill{ci-local}`. On success: commit fixes separately, include them in the push. On failure: abort.

### 4. Validate the branch

Reject immediately if on a protected branch. Workflow for recovery: [references/recovery.md](references/recovery.md) and `.agents/rules/branch-workflow.md`.

### 5. Validate target and scope

**Target validation:**

- Remote exists or can be created.
- Branch name is valid.
- **Protected branches blocked**: `main`, `master`, `develop`, `production`, `release/*`.
- Write access verified.

**Scope validation — review commits to push:**

```bash
git log <remote>/<branch>..HEAD --oneline
git diff <remote>/<branch>..HEAD --stat
```

Checks:

- [ ] Conventional-commit format.
- [ ] Documentation updated per `.agents/rules/documentation.md`.
- [ ] Structure maintained per `.agents/rules/project-structure.md`.
- [ ] No secrets in diff (`git diff <remote>/<branch>..HEAD | grep -iE 'password|secret|token|api[_-]?key|private[_-]?key'`).
- [ ] No credential files (`\.env|credentials|secrets`).
- [ ] No build artifacts (respect `.gitignore`).

### 6. Choose push strategy

| Situation | Command |
|-----------|---------|
| First push (new remote branch) | `git push -u <remote> <branch>` |
| Regular push | `git push <remote> <branch>` |
| Rebased / amended | `git tag backup/force-push-$(date +%Y%m%d-%H%M%S) && git push --force-with-lease` |

**Never use plain `--force`.** Always `--force-with-lease`. Skip force push entirely on shared branches or after PR review.

### 7. Execute and verify

```bash
if git rev-parse --verify <remote>/<branch> 2>/dev/null; then
  git push <remote> <branch>
else
  git push -u <remote> <branch>
fi

git ls-remote --heads <remote> <branch>
git log <remote>/<branch> --oneline -5
```

### 8. Next steps after push

| Situation | Action |
|-----------|--------|
| PR does not exist | `gh pr create --title "..." --body "..." --base main --head <branch>` |
| PR exists (updated) | `gh pr comment <n> --body "Updated with latest changes"` |
| Pushed to fork | `gh pr create --repo <upstream> --head <fork>:<branch> --base main` |

### 9. Report

After pushing, summarize: remote/branch, commits pushed, CI status, any auto-fixes applied, and PR URL if created.

## Flags

- `--check` — run `$skill{ci-local}` before pushing; abort on failure (unless `--fix`).
- `--fix` — implies `--check`; runs `$skill{ci-local}`, auto-fixes linting, re-runs checks, commits fixes separately, and pushes them too.

Usage examples and target syntax: see [references/target-resolution.md](references/target-resolution.md).

## Protected branches (never push directly)

`main`, `master`, `develop`, `production`, `release/*`. If accidentally on one, STOP and follow `.agents/rules/branch-workflow.md` + recovery.md.

## Anti-patterns

- Pushing to main "just this once".
- `--force` without `--lease`.
- Pushing without reviewing commits.
- Skipping secret scanning.
- Force-pushing shared branches.
- Pushing before CI passes locally.

## Recovery

For wrong branch, leaked secrets, or main-branch mistakes: [references/recovery.md](references/recovery.md).

## Integration

- `$skill{git-commit}` — commit validation upstream.
- `$skill{ci-local}` — local CI checks.
- `.agents/rules/branch-workflow.md` — branch workflow enforcement.

## Notes

- Always validate target, branch, and scope before pushing.
- Use `--force-with-lease` over `--force`.
- `--check` catches CI failures pre-push.
- `--fix` auto-fixes and commits fixes separately.
