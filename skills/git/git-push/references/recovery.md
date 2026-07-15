# Push Recovery Scenarios

Recovery procedures for common push failures. Always create a backup before force operations.

## Pushed to wrong branch

```bash
git push <remote> --delete <wrong-branch>
git push <remote> <correct-branch>
```

## Pushed secrets

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

## Pushed to main by mistake

Follow `.agents/rules/branch-workflow.md`:

1. Create feature branch from before the offending commits.
2. Cherry-pick commits.
3. Reset main to origin.
4. Force-push main reset.
5. Push feature branch.
6. Open a PR.

## Pushed to protected branch (general)

1. STOP — do not force-push unless absolutely necessary.
2. Create backup tag/branch first:
   ```bash
   git tag backup/force-push-$(date +%Y%m%d-%H%M%S)
   git branch backup/force-push-$(date +%Y%m%d-%H%M%S)
   ```
3. Recover commits on a new branch, then re-open the PR from there.
