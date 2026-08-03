---
description: Push commits to remote with validation of target and scope
argument-hint: --check --fix <target>
---

Push commits to remote after analyzing target, validating branch, commit scope, and optionally running local CI checks before pushing.

**This command wraps the `git-workflow-and-versioning` skill workflow.**

## Usage

```
/push
/push <target>
/push --check
/push --check <target>
/push --fix
/push --check --fix <target>
```

**Target can be:**
- **Branch name**: `feat/my-feature` - Push to specific branch
- **PR number**: `#123` or `123` - Push to PR's head branch
- **Remote name**: `upstream`, `fork` - Push to different remote
- **External project**: `username/repo` or `https://github.com/username/repo` - Push to fork
- **Submodule**: `submodules/my-submodule` - Push submodule changes
- **No target**: Push current branch to tracked remote

## Flags

### --check

**Run local CI checks before pushing:**
- Detects CI configuration (GitHub Actions, GitLab CI, Azure Pipelines, etc.)
- Parses validation steps (lint, type-check, test, build)
- Runs checks locally (skips deployment/cloud-specific steps)
- Reports results for checks that ran (ci-local stops on first failure unless --fix is set)
- **Aborts push if checks fail** (unless --fix flag)

**Use when:**
- You want to catch CI failures before pushing
- You're working on a project with strict CI requirements
- You want to ensure code quality before pushing

### --fix

**Auto-fix linting failures:**
- Implies --check (runs CI checks first)
- Attempts to fix linting/formatting issues:
  - **Linting**: Code formatting, import sorting, unused code
  - **Type errors, tests, and build are NOT auto-fixed** — these still abort the push
- Re-runs checks after auto-fix
- **Commits fixes separately**
- **Includes fix commits in push**
- Reports fix commits in push summary
- **Aborts push if auto-fix fails**

**Use when:**
- You have any CI failures that can be auto-fixed
- You want to ensure clean pushes
- You're confident in auto-fix strategies

**Note:** Not all failures can be auto-fixed. Complex logic errors, design issues, and some test failures require manual intervention.

## Workflow

The agent will:
1. **Analyze target** - Determine if it's branch, PR, remote, fork, or submodule
2. **Run local CI checks** (if --check flag)
   - Detect CI configuration
   - Parse validation steps
   - Run checks locally
   - Report results
3. **Auto-fix linting** (if --fix flag)
   - Fix linting and formatting issues
   - Re-run checks
   - Commit fixes separately
4. **Validate current branch** - Ensure not on main/master/protected branches
5. **Resolve target** - Determine remote name, branch name, and push refspec
6. **Validate push target** - Verify remote exists, branch valid, permissions
7. **Validate commit scope** - Review commits, scan for secrets, check conventions
8. **Determine push strategy** - First push vs regular vs force-with-lease
9. **Execute push** - Push with appropriate strategy (includes fix commits if --fix)
10. **Verify success** - Confirm commits on remote
11. **Next steps** - Create or update PR

## Examples

**Push to current branch's remote:**
```
/push
/push --check
```

**Push to specific branch:**
```
/push feat/my-feature
/push --check feat/my-feature
```

**Push to PR with auto-fix:**
```
/push #123
/push --fix #123
/push --check --fix #123
```

**Push to different remote:**
```
/push upstream
/push --check upstream
```

**Push to external project/fork:**
```
/push username/repo
/push --check --fix username/repo
```

**Push submodule:**
```
/push submodules/my-submodule
```

## Protected Branches

**Never push directly to:**
- `main`
- `master`
- `develop`
- `production`
- `release/*`

If on protected branch, agent will stop and guide recovery per `.agents/rules/branch-workflow.md`.

## Push Strategies

**First push (new branch):**
```bash
git push -u <remote> <branch>
```

**Regular push:**
```bash
git push <remote> <branch>
```

**Force push (with caution):**
```bash
git push <remote> <branch> --force-with-lease
```

**NEVER use `--force` without `--lease`** to prevent overwriting others' work.

## Validation

Before pushing, agent validates:
- [ ] Not on protected branch
- [ ] Target resolved correctly (branch/PR/remote/fork/submodule)
- [ ] Local CI checks passed (if --check flag)
- [ ] Auto-fixes applied for ALL check types (if --fix flag)
- [ ] Commits follow conventional commits format
- [ ] Documentation updated (per documentation.md rule)
- [ ] Structure maintained (per project-structure.md rule)
- [ ] No secrets or credentials in commits
- [ ] No build artifacts (respects .gitignore)

## Full Workflow

See `.agents/skills/git-workflow-and-versioning/SKILL.md` for the complete workflow including:

- Target analysis and resolution (branch, PR, remote, fork, submodule)
- Local CI checks (--check flag)
- Auto-fix workflow for ALL check types (--fix flag)
- Branch validation and recovery procedures
- Push target validation
- Commit scope validation and secret scanning
- Push strategy determination
- Success verification
- PR creation/update

## Precondition Rules

This command enforces:
- `.agents/rules/branch-workflow.md` - Feature branch workflow
- `.agents/rules/documentation.md` - Documentation validation
- `.agents/rules/project-structure.md` - Structure validation
- `.agents/skills/ci-local/SKILL.md` - Local CI checks (if --check flag)

**Never push to protected branches.** Always work on feature branches.

## Related

- `.agents/skills/git-workflow-and-versioning/SKILL.md` - Full workflow implementation (commit and push)
- `.agents/skills/ci-local/SKILL.md` - Local CI checks and auto-fix
- `.agents/rules/branch-workflow.md` - Branch workflow enforcement