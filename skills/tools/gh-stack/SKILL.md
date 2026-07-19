---
name: gh-stack
description: Use the GitHub CLI gh-stack extension (github/gh-stack) to manage Stacked PRs locally and manually create/link PRs when the GitHub Stacked PRs feature is not enabled.
triggers:
  - user
  - model
allowed-tools:
  - read
  - bash
  - write
  - edit
  - grep
source: ThePlenkov/skills
---

# gh-stack

Use the GitHub CLI extension `github/gh-stack` for managing **Stacked PRs**.

## When to use

- Setting up a stack of dependent branches locally.
- Navigating, rebasing, and pushing a chain of branches.
- Creating stacked PRs when the GitHub "Stacked PRs" feature is available (private preview).
- Working around the missing feature by creating PRs manually with `gh pr create`.
- Evaluating a custom `gh` extension / CLI that reuses `gh-stack` local logic without the GitHub Stack API.

## Prerequisites

- `gh` CLI installed and authenticated. See $github for authentication.
- `gh-stack` extension installed:
  ```bash
  gh extension install github/gh-stack
  ```

## Core concepts

- **Stack** — ordered list of branches where each branch builds on the previous.
- **Trunk** — base branch, usually `main`.
- **Bottom** — branch closest to trunk.
- **Top** — branch farthest from trunk.
- **Local metadata** — stored in `.git/gh-stack` (JSON, not committed).

## Commands

| Command | Purpose |
|---|---|
| `gh stack init <branch>` | Create a stack and first branch from trunk. |
| `gh stack add <branch>` | Add a new layer on top of the current branch. |
| `gh stack view` / `--json` / `--short` | Show the stack structure and PR status. |
| `gh stack up/down/top/bottom/trunk/checkout` | Navigate between layers. |
| `gh stack push` | Push all branches in the stack atomically. |
| `gh stack sync` | Fetch, rebase, push, and sync PR state. |
| `gh stack rebase` | Cascade rebase onto updated parents. |
| `gh stack submit` | Create PRs and the remote Stack on GitHub. |
| `gh stack link` | Create a remote Stack without local tracking. |
| `gh stack unstack` | Remove local and remote stack tracking. |

## Local workflow without Stacked PRs enabled

GitHub Stacked PRs are in private preview. `gh stack submit` and `gh stack link` fail with:

```
⚠ Stacked PRs are not enabled for this repository
```

The local part of `gh-stack` still works:

```bash
gh stack init feature/auth
# ... commit auth layer ...

gh stack add feature/api
# ... commit api layer ...

gh stack push
```

## Manual PR creation (hybrid workflow)

Create PRs manually in bottom-up order so each PR has the correct `base`:

```bash
gh pr create --base main --head feature/auth --title "feat: auth" --draft
gh pr create --base feature/auth --head feature/api --title "feat: api" --draft
```

After manual PR creation, `gh stack view` shows PR numbers and `gh stack sync` will update branches and PR state. It will warn about the missing Stack feature, but will still push and sync.

```
$ gh stack sync --remote origin
✓ Fetched latest changes from origin
✓ Trunk main is already up to date

Pushing 2 branches to origin...
✓ Pushed 2 branches

Syncing PRs ...
✓ PR #1 (feature/auth) — Open
✓ PR #2 (feature/api) — Open
⚠ Stacked PRs are not enabled for this repository

✓ Branches synced
```

## Merge a stack

`gh stack merge` is not implemented in the tested `gh-stack` versions. Use one of these:

### Bottom-up `gh pr merge`

If the PRs were created as drafts, mark them ready before merging:

```bash
gh pr ready 1
gh pr merge 1 --merge          # feature/auth → main

gh pr edit 2 --base main
gh pr ready 2
gh pr merge 2 --merge          # feature/api → main
```

### Rebase then fast-forward

```bash
# Merge the bottom PR first
gh pr ready 1
gh pr merge 1 --merge

# Rebase the top branch onto the updated main
git fetch origin
git checkout feature/api
git rebase --onto main feature/auth feature/api
git push --force-with-lease

# Update PR #2 and merge
gh pr edit 2 --base main
gh pr ready 2
gh pr merge 2 --merge
```

## Custom plugin based on gh-stack

The `gh-stack` extension can be replaced by a custom `gh` extension / CLI that uses the same local logic but skips the GitHub Stack API:

1. Reuse the local stack JSON model (`trunk`, ordered branches, `base`/`head` SHAs).
2. Reuse `init`, `add`, `view`, navigation, `push`, and rebase.
3. Replace `gh stack submit` with `gh pr create` in bottom-up order.
4. Replace `gh stack link` with a loop that updates PR `base` via `gh pr edit`.
5. Implement merge as bottom-up `gh pr merge` or `git merge --ff-only`.

## Important notes

- `gh stack sync` works with manually created PRs but cannot create a remote Stack without the feature.
- Closed PRs are ignored by `gh stack view`.
- Keep the working tree clean before `gh stack sync`; rebase operations may fail if there are uncommitted changes.
- The `.git/gh-stack` file is local and should not be committed.
