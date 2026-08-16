---
name: git-state
description: Inspect and explain a repository's local branches, worktrees, dirty state, merge requests or pull requests, and relationship to the current remote default branch. Use when asked where work stands, which branches or worktrees are safe cleanup candidates, why a merged PR/MR still appears ahead, or for a readable Git repository landscape.
---

# Git State

Produce an evidence-backed snapshot before proposing cleanup. Treat `ahead` and
`behind` as commit-ancestry facts, not as proof that code is unmerged.
In JSON output, `containedInBase` means the branch tip is an ancestor of the
comparison base; it does not report provider merge status.

## Workflow

1. Run the bundled, read-only analyser. Execute it from this skill directory
   and point `--repository` at the repository to inspect:

   ```sh
   node scripts/git-state.mjs --repository <repository-path> --refresh
   ```

   The script resolves `origin/HEAD`, refreshes only that branch when
   `--refresh` is supplied, and prints a stable Markdown table. Use
   `--format json` when another tool needs the same facts structurally.

2. If no `origin/HEAD` exists, resolve the default branch from the hosting
   provider. Pass the explicit comparison ref to the script:

   ```sh
   node scripts/git-state.mjs --repository <repository-path> --base origin/main
   ```

3. Read the hosting-provider MR/PR list with its available authenticated CLI
   (`glab` for GitLab, `gh` for GitHub). Match source branches, include the URL,
   and label an MR/PR as open, merged, or closed.

## Required Output

Use concise Markdown tables. Always state the comparison base and legend:

| Branch | Upstream | Relative to `origin/main` | MR / PR |
|---|---|---:|---|
| `feature/example` | `origin/feature/example` | 🟡 ↑2 ↓5 | [!42 merged](https://host.example/...) |

Use `🟢` when `ahead` is zero and `🟡` when it is non-zero. Show exact
`↑ahead ↓behind` values even for a branch whose reviewed changes are merged.
List current worktree, dirty files, prunable worktree metadata, and open MR/PRs
separately from the table.

The bundled script never deletes, stashes, switches branches, prunes refs, or
contacts the hosting provider. `--refresh` only runs `git fetch origin <branch>`.

## Interpret Merged Source Branches Correctly

A merged MR/PR source branch can retain commits that are not ancestors of the
default branch when the platform used squash or rebase merge. `↑N` then records
old source-branch history, not necessarily unmerged code.

For every merged branch that has `ahead > 0`:

1. Read the MR/PR's source head and merge or squash result from the provider.
2. Verify the merge or squash result is an ancestor of `origin/<default-branch>`:

   ```sh
   git merge-base --is-ancestor <merge-or-squash-sha> "origin/<default-branch>"
   ```

3. Compare the current branch tip with the provider's recorded source head.
   Different SHA means commits may have been added after the MR/PR merged.
4. When needed, use `git cherry -v "origin/<default-branch>" <branch>` to
   identify patch-equivalent commits.

Classify branches as:

- **Safe cleanup candidate:** reviewed merge result is in the default branch and
  no post-merge commits remain.
- **Needs review:** no MR/PR, a source commit post-dates the merged MR/PR, or
  the merge result is absent from the default branch.
- **Keep:** current branch, open MR/PR branch, or any branch with uncertain
  evidence.

## Cleanup Guardrail

Do not delete, prune, reset, switch branches, stash, or close an MR/PR during
the analysis. Present the classification and exact scope first.

Before any cleanup, invoke `$skill{safeguard}`. Preserve dirty state, create a
recoverable checkpoint, and obtain explicit approval for the exact worktrees,
branches, or remote branches to remove. Never remove an open validation MR/PR
merely because its local worktree is absent.
