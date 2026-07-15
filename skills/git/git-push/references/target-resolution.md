# Push Target Resolution

Rules and command templates for resolving the `/push` target argument into a `<remote> <refspec>` pair.

## Target types

| Format | Example | Resolved to |
|--------|---------|-------------|
| Branch name | `feat/my-feature` | `origin/feat/my-feature` |
| PR number | `#123` / `123` | push to PR head branch |
| Remote name | `origin`, `upstream`, `fork` | push current branch to that remote |
| External fork | `username/repo` or full URL | add as temp remote, push, remove |
| Submodule | `submodules/<name>` | push submodule, then `/commit` parent |
| (no target) | `/push` | push current branch to tracked remote |

## Detection commands

```bash
git branch --show-current
git remote -v
git branch -a | grep <target>
gh pr view <target> 2>/dev/null
git remote | grep <target>
```

## Resolution templates

**Branch name:**

```bash
git push origin feat/my-feature
```

**PR number:**

```bash
pr_branch=$(gh pr view 123 --json headRefName -q .headRefName)
git push origin HEAD:$pr_branch
```

**Remote name:**

```bash
current_branch=$(git branch --show-current)
git push upstream $current_branch
```

**External project:**

```bash
git remote add temp-push https://github.com/username/repo
git push temp-push <current-branch>
git remote remove temp-push
```

**Submodule:**

```bash
cd submodules/my-submodule
git push origin HEAD
cd ../..
# then /commit to create the parent-repo commit for the submodule update
# do NOT auto-commit — wait for explicit /commit
```
