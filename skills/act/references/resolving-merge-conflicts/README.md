---
name: resolving-merge-conflicts
description: Use when an in-progress `git merge` or `git rebase` has produced conflict markers. Resolves hunks by tracing each side's intent to its primary source (commit message, PR, issue, ticket). Refuses to invent new behaviour, prefers `--continue` over a bare commit, and asks the user before any `--abort`.
metadata:
  upstream: mattpocock/skills
  upstream_path: skills/engineering/resolving-merge-conflicts/
  note: Adapted from mattpocock/skills.
  allowed-tools: read, grep, glob, exec
  tier: 2
  triggers:
    - user
    - model
  source: ThePlenkov/skills
source: ThePlenkov/skills
---

<!--
Upstream: mattpocock/skills @ skills/engineering/resolving-merge-conflicts
Adapted for theplenkov-ai/skills conventions. No semantic changes.
-->

# Resolving Merge Conflicts

A discipline for working through conflict markers that have appeared in your tree. Skip phases only when explicitly justified.

1. **See the current state** of the merge/rebase. Check git history and the conflicting files. Run `git status` and `git diff --name-only --diff-filter=U` to enumerate conflicted files.

2. **Find the primary sources** for each conflict. Understand deeply why each change was made and what the original intent was. Read the commit messages, check the PRs/MRs, and trace the originating issues or tickets. **If you cannot trace the intent for either side, stop and ask the user before guessing.**

3. **Resolve each hunk.** Preserve both intents where possible. Where incompatible, pick the one matching the merge's stated goal and note the trade-off in the commit message. Do **not** invent new behaviour. Default to resolving — and ask the user before running `--abort` (the abort can silently discard uncommitted work the user wanted to keep).

4. Discover the project's **automated checks** and run them — typically typecheck, then tests, then format. Fix anything the merge broke.

5. **Finish the merge/rebase.** Stage **only the conflict-resolution paths** (the file list from step 1) and any edits produced by step 4's automated checks, then continue the in-progress operation with the operation-specific next step: `git merge --continue` for a merge, `git rebase --continue` for a rebase. Do not run a bare `git commit` after a paused rebase — that detaches the rebase from its sequence and leaves the operation in an inconsistent state.

**Completion check (operation-agnostic).** After either operation completes, confirm:

- **No merge or rebase remains in flight** — explicitly check that **neither** of these is set:
  - `.git/MERGE_HEAD` exists → a merge is in progress (resolvable paths may be empty but the operation is not actually finished).
  - `.git/rebase-merge/` or `.git/rebase-apply/` exists → a rebase is in progress.
  A clean `git status` is **not** sufficient: a resolved-but-unfinished merge can have no unmerged paths and a clean worktree while `MERGE_HEAD` still exists. Use `test -f .git/MERGE_HEAD && echo "merge in progress"` and `ls .git/rebase-merge .git/rebase-apply 2>/dev/null` to assert.
- **No unmerged paths remain** — `git diff --name-only --diff-filter=U` returns nothing.
- **`HEAD` is on the expected branch** — verify the branch matches what step 1 set out to merge or rebase onto. **For a rebase, `HEAD` returns to the branch that was rebased (the source), not the branch that was rebased onto (the base)**: after a successful `git rebase main` run from `feature`, `HEAD` is on `feature`, not on `main`. Asserting `HEAD == main` after that rebase would be incorrect. For a merge, `HEAD` stays on whichever branch was checked out when the merge started (typically the receiver). The pre-existing dirty worktree is not a failure: report unrelated user changes as preserved, not as a problem to clean up.

## Why no `--abort`

`--abort` discards the work the other side was doing **and the work you were doing** — it returns the tree to the state before the merge or rebase started, including all your in-progress edits that were not yet committed. The cost of resolution is usually lower than the cost of starting over, and the primary-source step exists precisely to make resolution cheap. Reserve `--abort` for the rare case where the operation is fundamentally broken (wrong base branch, divergent strategies that can't reconcile, or you realise the merge is on the wrong base) — and even then, ask the user first, because aborting silently can lose a session's worth of uncommitted work that the user wanted to keep.

## Related skills

- **act** — for resolving review-thread conflicts on a PR/MR; the discipline is similar but the artefacts are review comments, not git markers.
- **debugging** — when the merge appears clean but behaviour has changed; treat it as a regression and run the 4-phase Reproduce → Hypothesise → Fix loop when tests fail after the merge is "done".
