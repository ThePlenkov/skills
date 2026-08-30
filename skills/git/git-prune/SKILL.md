---
name: git-prune
description: Delete stale local branches that are behind the comparison base and not ahead, with no uncommitted changes. Reuses $skill{git-status} for branch facts. Dry-run by default; --apply deletes after mandatory $skill{safeguard} approval. Use to clean up merged/stale branch clutter safely.
---

# Git Prune

Deletes local branches that are stale: **behind the base AND not ahead** (no
unique commits), or whose upstream is gone. Reuses `$skill{git-status}` for the
branch facts so the dashboard and the prune share one source of truth.

## Workflow

### 1. Dry-run first (always)

Run the bundled script without `--apply` to list candidates and the reason each
is a candidate:

```sh
node --experimental-strip-types scripts/git-prune.ts --repository <repository-path>
```

Pass `--base origin/main` if `origin/HEAD` is unset. Use `--refresh` to fetch the
base first. The script never deletes in dry-run mode.

A branch is a candidate when ALL of:
- `ahead === 0` (no unique commits — nothing would be lost)
- `behind > 0` OR upstream is gone
- it is not the current branch
- the working tree has no uncommitted changes (current branch is never pruned)

### 2. Safeguard before any deletion

`git-prune --apply` is a destructive operation. Before running it, load and
follow `$skill{safeguard}`:

- `$skill{safeguard}` inspects repository state, creates a checkpoint of all
  at-risk work, and requests explicit user approval.
- Use the dry-run candidate list from Step 1 to explain the exact scope.
- Do not create a separate checkpoint branch or stash here.
- Only proceed after `$skill{safeguard}` reports explicit approval.

### 3. Apply (only after safeguard approval)

```sh
node --experimental-strip-types scripts/git-prune.ts --repository <path> --apply --safeguard-approved
```

The `--safeguard-approved` flag is a machine-checkable gate: the script refuses
to delete without it. Pass it only after `$skill{safeguard}` has reported
explicit approval.

Add `--prune-remotes` to also run `git remote prune origin` for stale
remote-tracking refs. The script uses `git branch -d` (safe delete): `-d`
refuses any branch not fully merged into its upstream (or into current HEAD
when upstream is gone), so gone-upstream or diverged candidates that aren't
merged get refused as a second safety net.

### 4. Verify

```sh
node --experimental-strip-types ../git-status/scripts/git-status.ts --repository <path>
```

Confirm the candidates are gone and no branch with unique work was removed.

## Required Output

Report the candidate list with reasons, the safeguard checkpoint path, the
count deleted vs failed, and the post-prune dashboard.

```
git-prune  (base: origin/main)  mode: APPLY

  🔻 stale/behind                    behind 1, ahead 0
  🔴 gone-upstream                   upstream gone

2 candidate(s).
  deleted stale/behind
  deleted gone-upstream

Pruned 2, failed 0.
```

## Guardrail

- Never run `--apply` without `$skill{safeguard}` approval.
- Never prune the current branch.
- Never prune a branch with `ahead > 0` (it has unique commits).
- `git branch -d` (not `-D`) is mandatory — it refuses unmerged branches.
- The dry-run is read-only and safe to run any time.

## Related Skills

- `$skill{git-status}` — the dashboard whose JSON output this skill reuses.
- `$skill{safeguard}` — required before `--apply`.
- `$skill{git-state}` — heavier merge/MR-PR classification when "stale" is ambiguous.
