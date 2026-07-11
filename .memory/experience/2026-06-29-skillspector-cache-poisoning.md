# 2026-06-29 — Cache poisoning in composite GitHub Actions with custom Nx plugin

## Symptom
Three failures stacked on the `skill-scan` workflow when the action used a
self-contained Nx workspace (`RUNTIME_WS=$(mktemp -d ...)` + `cp -r` +
symlinks + `NX_CACHE_DIRECTORY=/tmp/nx-skillspector-cache`):

1. `Path Validation Error: /tmp/nx-skillspector-cache does not exist` on
   cache misses (Nx never ran there before save).
2. `Failed to save: another job may be creating this cache` race with
   `concurrency.cancel-in-progress`.
3. `Cache Size: ~0 MB (7519 B)` after a full scan — restore hit but task
   hash always invalidated.

## Root cause (#3, the silent one)
`createNodes` in `nx-skillspector` passed
`workspaceRoot: context.workspaceRoot` as an executor option. Nx hashes
the options object as part of the task hash, and `context.workspaceRoot`
was the absolute path of the per-run `mktemp -d` directory — unique every
run. Every task was a hash miss, so the restore key matched by content
hash but no task result was ever reused.

Lesson: **never pass an absolute, machine-/run-specific path into
executor options if Nx is going to hash them**. Use `context.root` inside
the executor instead — Nx already has it but doesn't put it in the
hash.

## Verification gap I missed
The repo has a self-referencing symlink (`act/act`) that the old code
worked around via a symlink-pruning `find`. My local reproduction worked
because I copied the skills into a clean tmp dir without that symlink.
CI had the symlink and exercised a code path I hadn't covered.

Rule: **when reproducing CI locally, start from a fresh checkout of the
actual repo at the same SHA, not a sanitized copy**. Otherwise you
exercise a different input domain than CI does.

## Secondary bug discovered
`toRel()` in the plugin checked `rel.startsWith('.')` and stripped 2
chars unconditionally. Worked when paths were `agents/skills/foo` (no
leading dot). Breaks when paths are `.agents/skills/foo` — strips `.a`
and produces `gents/skills/foo`. Fix: only strip the literal `./`
prefix.

Rule: **don't use `startsWith('.')` to mean "starts with `./'"**. The
former is a much wider condition.

## Architectural simplification
The `RUNTIME_WS` indirection (mktemp + cp -r + symlinks + heredoc
nx.json) was unnecessary. The action can just stage its `nx.json` into
the host repo with a `mktemp` + `trap` save/restore, run `npx nx` from
the standard checkout, and let Nx's default `.nx/cache` carry through.
Net: -150 lines, working cache.

Rule: **before designing a complex isolation layer, check if the
underlying tool (Nx) has a documented way to handle the host case
cleanly**. Most build tools have a "stage a config file in the host"
pattern.