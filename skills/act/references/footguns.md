# `/act` Footguns

Long-tail Wrong-vs-right entries that have come up on past PRs. The
SKILL body carries the core procedure; the entries below are the
ones that are easy to forget and costly when violated. Read this when
you're about to do something that feels like a shortcut.

## Git operations

### `git stash push && git checkout other && git stash pop` to relocate WIP

**Wrong.** `git commit -am` skips untracked files, so inspect with
`git status --short` before committing WIP. Stash silently drops
content if the index is dirty in the wrong way.

**Right.** `git add -A && git commit -am WIP` (or explicitly stage
new untracked files first) on the current branch, then
`git checkout -b new` / `git cherry-pick` / `git reset` cleanly.

### `git add -A` in an unfamiliar repo, then `git commit`

**Wrong.** The repo's `.gitignore` may not cover nested scratch
dirs (`tmp/agent/`, `tmp/<run>/`) even when `/agent/` is ignored.

**Right.** `git status --short` first; add explicit paths. Never
`git add -A` until you have read the staged diff.

## Scripts runner

### Bypass `scripts/run.ts` and run `npx tsx <script.sh>` (or any non-TS) directly

**Wrong.** Direct `npx tsx <path>` throws `ERR_UNKNOWN_FILE_EXTENSION`
on non-TS scripts.

**Right.** Always go through `npx tsx scripts/run.ts <script>`. The
runner inspects the extension and dispatches `.ts/.js/.mjs/.cjs` to
`tsx`, `.py` to `python` on Windows / `python3` elsewhere, and
anything else (including `.sh`) to a POSIX shell via
`resolveTrustedBash()` (with Windows fallbacks). The runner also
enforces realpath-based path containment plus an `isFile()` guard, and
documents the symlink trust boundary in the source.

## Conversation flow

### Pause to describe an action when the user's phrasing could be read as an imperative

**Wrong.** "какой PR?" / "what's the PR?" mid-flow usually means
"open it", not "explain it".

**Right.** Prefer the imperative reading when context is forward
motion. Continue the action; do not pause to describe it.

## Stack operations

### `gh stack rebase && gh stack push` after every single-PR fix

**Wrong.** This pushes all branches in the stack (e.g. 19 PRs),
triggering CI on every one of them — even branches whose HEAD SHA
did not change. Bot re-evaluations fire on unchanged diffs, creating
noise and wasting runner minutes.

**Right.** Check which branches have new commits (`git rev-parse
<branch>` vs `git rev-parse origin/<branch>`). Push only changed
branches. Use `gh stack push` only when the stack base changed or a
lower-stack commit altered downstream diffs. See
[stack-mode.md](stack-mode.md) for the full procedure.

## Review-only PRs

### Create a `review/<name>` base branch in the same repo to review already-merged `main` commits

**Wrong.** Inventing a custom base branch (`review/post-merge-fixes`,
`review/backup-fix`, etc.) inside the user's repository and opening
`main` → `review/<name>` to trigger automated review on commits that
are already on `main`. Two failure modes:

1. **Stale branch** — the `review/*` branch persists after the PR is
   merged/closed, cluttering the repo.
2. **Auto-created reverse PR** — when the review PR merges, GitHub
   opens a new PR from `review/<name>` back to `main` (observed: PR
   #11 auto-created from `review/post-merge-devsy-fixes` after PR #10
   merged). The user then has to clean up an unexpected PR they never
   asked for.

This happened twice in one session and frustrated the user both times.

**Right.** `/act` operates on an *existing* PR — it is not a tool for
manufacturing review PRs around already-merged work. Pick one:

1. **Fork** — use `[shadow-fork](shadow-fork/SKILL.md)` and open the review PR from
   the fork to upstream. No branches live in the user's repo.
2. **No PR** — run review tools directly on `main` (Codacy, CodeQL,
   Semgrep, Trivy, etc. can scan commits without a PR). Prefer this
   when no human review is needed.
3. **Ephemeral empty branch** — if a PR object is truly required,
   open `main` → an empty branch, then **close the PR and delete the
   branch immediately** once review completes.

Never leave `review/*` (or any review-only) branches behind in the
user's repository.
