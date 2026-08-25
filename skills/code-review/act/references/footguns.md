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
