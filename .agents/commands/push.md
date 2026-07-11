---
description: Push commits to remote with validation of target and scope
argument-hint: <target>
---

Push commits to remote after analyzing target, validating branch, commit scope, and preventing accidental pushes to protected branches.

**This command wraps the `git-push` skill workflow.**

## Usage

```
/push
```

or

```
/push <target>
```

**Target can be:**
- **Branch name**: `feat/my-feature` - Push to specific branch
- **PR number**: `#123` or `123` - Push to PR's head branch
- **Remote name**: `upstream`, `fork` - Push to different remote
- **External project**: `username/repo` or `https://github.com/username/repo` - Push to fork
- **Submodule**: `submodules/my-submodule` - Push submodule changes
- **No target**: Push current branch to tracked remote

The agent will:
1. **Analyze target** - Determine if it's branch, PR, remote, fork, or submodule
2. **Validate current branch** - Ensure not on main/master/protected branches
3. **Resolve target** - Determine remote name, branch name, and push refspec
4. **Validate push target** - Verify remote exists, branch valid, permissions
5. **Validate commit scope** - Review commits, scan for secrets, check conventions
6. **Determine push strategy** - First push vs regular vs force-with-lease
7. **Execute push** - Push with appropriate strategy
8. **Verify success** - Confirm commits on remote
9. **Next steps** - Create or update PR

## Examples

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

**Push to external project/fork:**
```
/push username/repo
/push https://github.com/username/repo
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
- [ ] Commits follow conventional commits format
- [ ] Documentation updated (per documentation.md rule)
- [ ] Structure maintained (per project-structure.md rule)
- [ ] No secrets or credentials in commits
- [ ] No build artifacts (respects .gitignore)

## Full Workflow

See `.agents/skills/git-push/SKILL.md` for the complete workflow including:

- Target analysis and resolution (branch, PR, remote, fork, submodule)
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

**Never push to protected branches.** Always work on feature branches.

## Related

- `.agents/skills/git-push/SKILL.md` - Full workflow implementation
- `.agents/rules/branch-workflow.md` - Branch workflow enforcement
- `.agents/skills/git-commit/SKILL.md` - Commit workflow