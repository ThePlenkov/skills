# Stack mode — `/act stack`

<!-- os-independence-exempt: contains bash recipes for stack tooling (Git Bash / WSL on Windows) -->

Full procedure for running `/act` on a stacked branch series.

## Why stack mode is efficient

Processing a stack of N PRs is **not** N × single-PR time. Two
optimizations make it much faster:

1. **Don't wait for CI between PRs.** After pushing PR #1, immediately
   move to PR #2 to analyze and fix while CI runs on #1. CI is async —
   your analysis isn't. By the time you've fixed PR #5, CI on PR #1 is
   done and you can check it on the round-robin pass.

2. **Analyze all PRs at once.** Fetch all thread states upfront (before
   fixing anything). This lets you see patterns across PRs and batch
   similar fixes (e.g. "all 5 PRs have the same localeCompare comment"
   → fix them all in one pass). Processing each PR in isolation misses
   these patterns.

The result: a 19-PR stack converges in 2-3 round-robin passes, not 19
serial iterations.

## Discovery

```bash
# Get the ordered stack (bottom to top)
gh stack view

# Or list format for scripting
gh stack list
```

The stack is ordered bottom-to-top: `main → branch-A (PR #1) → branch-B (PR #2) → ...`

Each PR's base is the branch below it. Changing a lower branch may
require rebasing all branches above it.

## Processing order

Process **bottom-to-top**. The lowest PR in the stack is the foundation
— if it has issues, everything above it inherits them.

```
main → PR #1 (bottom) → PR #2 → PR #3 → ... → PR #N (top)
       ^^^ fix this first
```

For each PR, run the normal `/act` loop:
P0a (CI) → P0b (SAST) → P1–P3 (threads) → P4 (resolve) → P5 (rate).

**But don't block on CI.** The efficient pattern is:

1. Fetch all thread states for all PRs **upfront** (one batch of GraphQL
   queries). This gives you the full picture before fixing anything.
2. Start fixing PR #1 (bottom). Fix threads, commit, push.
3. **Don't wait for CI on PR #1.** Immediately move to PR #2. Fix
   threads, commit, push.
4. Continue up the stack. By the time you reach PR #5, CI on PR #1 is
   likely done.
5. On the round-robin re-scan, check CI results and new bot comments
   from bottom to top.

This turns N serial wait-for-CI cycles into one parallel analysis pass
+ one CI verification pass.

## Push optimization — the critical efficiency rule

### The problem

`gh stack push` pushes **all** branches in the stack. If you have 19
PRs and you only changed the top branch, `gh stack push` still pushes
all 19, triggering CI on all 19 PRs. This wastes runner minutes and
causes bot re-evaluations on unchanged diffs.

### The solution: push only changed branches

Before pushing, check which branches actually have new commits:

```bash
#!/usr/bin/env bash
# stack-changed.sh — list stack branches with local != remote
set -euo pipefail

# Get stack branches (adjust to your stack tool's output format)
branches=$(gh stack list 2>/dev/null | awk '{print $1}')

for branch in $branches; do
  local_sha=$(git rev-parse "$branch" 2>/dev/null || echo "missing")
  remote_sha=$(git rev-parse "origin/$branch" 2>/dev/null || echo "missing")
  if [ "$local_sha" != "$remote_sha" ]; then
    echo "CHANGED: $branch ($local_sha → $remote_sha)"
  fi
done
```

Push only the changed branches:

```bash
# Push a single branch
git push origin <branch>

# Force-push if rebased (history changed)
git push --force-with-lease origin <branch>

# Push multiple changed branches
for branch in $(stack-changed.sh | awk '{print $2}'); do
  git push --force-with-lease origin "$branch"
done
```

### When to use `gh stack push` (full stack push)

Use `gh stack push` only when:

| Situation | Action |
|-----------|--------|
| Bottom branch (`main`) got new commits | `gh stack rebase && gh stack push` |
| Lower-stack PR changed its diff | Rebase downstream + push affected branches |
| User explicitly asks for full refresh | `gh stack rebase && gh stack push` |
| Only top branch changed | `git push origin <top-branch>` (no rebase) |
| Single PR fix, no downstream impact | `git push origin <branch>` (no rebase) |

### Decision flowchart

```
Did the fix change a lower-stack branch's diff?
├── YES → Will downstream branches conflict?
│         ├── YES → gh stack rebase, push affected branches
│         └── NO  → push just the changed branch
└── NO  → Push just the changed branch
```

## CI waiting strategy

After pushing, wait for CI **only on the pushed branches**:

```bash
# Wait for CI on a specific PR — filter by commit SHA, not just branch
sha=$(gh api repos/<owner>/<repo>/pulls/<PR> --jq '.head.sha')
gh run watch --repo <owner>/<repo> $(gh run list --repo <owner>/<repo> --branch <branch> --commit "$sha" --json databaseId --jq '.[0].databaseId')
```

Do not wait for CI on branches whose HEAD SHA did not change — their
CI status is unchanged from the previous run.

## Round-robin convergence

After reaching the top of the stack, re-scan from the bottom:

1. Query all PRs for new unresolved threads (bots may have posted
   new comments after the latest CI run). **Use `reviewThreads(last: 100)`**
   (not `first: 100`) — after a rebase, new bot threads are appended at the
   end, and `first: 100` returns the oldest (already resolved) threads,
   causing you to miss new findings. Prefer the `pr-state.ts` helper which
   paginates correctly.
2. Query all PRs for CI status (a lower-stack push may have triggered
   CI on downstream PRs).
3. If any PR has new findings, process it again (bottom-to-top).
4. Repeat until all PRs are merge-ready.

### Convergence check

All PRs in the stack are merge-ready when:

+ Every PR has `open_threads=0`.
+ Every PR has `CI_REQUIRED_PENDING=0` and `SAST_FINDINGS_PENDING=0`.
+ No new bot comments appeared in the last CI cycle (compare bot
  comment count before and after the last push).
+ Every PR's `mergeable_state` is `clean` (not `conflict` or `dirty`).

`mergeable_state: unstable` is acceptable — it means pending review
approval or non-required checks running, not a conflict.

## Conflict resolution in a stack

If a lower-stack change causes conflicts in downstream branches:

1. **Do not blindly resolve** — trace each side's intent to its
   primary source (commit message, PR description). Use
   `$skill{resolving-merge-conflicts}`.
2. Resolve conflicts on the downstream branch only.
3. Push the downstream branch.
4. Verify CI on the downstream branch.

If conflicts are complex or involve semantic changes (not just textual
conflicts), escalate to the user with the conflict details.

## Stack-aware thread resolution

When resolving threads on a stacked PR:

+ Threads on **lower** PRs may be resolved by commits on **higher** PRs
  if the fix is in a file that the higher PR also touches. In that case,
  reply on the lower PR pointing to the commit on the higher branch.
+ Threads on **higher** PRs that reference code from **lower** PRs should
  be fixed on the higher PR (the lower PR's code is already merged into
  the higher branch via the stack).
+ Do not resolve a thread on a lower PR by saying "fixed in the upper
  PR" unless the upper PR's commit actually changes the line the thread
  points at.

## Summary reporting

At the end of stack processing, report:

```
Stack: N PRs (PR #1 → PR #N)
  PR #1: merge-ready (CI green, 0 threads)
  PR #2: merge-ready (CI green, 0 threads)
  ...
  PR #N: merge-ready (CI green, 0 threads)

Pushes: X branches pushed (Y full-stack rebases)
CI runs: Z (optimized — only changed branches)
```

Include the push count to show the optimization worked.
