---
name: git-status
description: Read-only branch dashboard. Lists every local (and optionally remote-tracking) branch with ahead/behind counts, diff insertions/deletions, upstream tracking status, and a UI-friendly symbol/colour summary. Use for a quick, pretty Git landscape before cleanup, reviews, or sync decisions. Never mutates the repository.
---

# Git Status

A focused, read-only branch dashboard. Distinct from `$skill{git-state}`, which
performs heavier worktree + MR/PR merge-classification analysis. Use `git-status`
for the fast "what does my branch landscape look like" view; use `git-state` when
you need safe-cleanup classification of merged PR source branches.

## Workflow

1. Run the bundled, read-only dashboard from this skill directory, pointing
   `--repository` at the repository to inspect:

   ```sh
   node --experimental-strip-types scripts/git-status.ts --repository <repository-path>
   ```

   Modern Node (>= 22.6) runs the TypeScript source natively; no build step.

2. If `origin/HEAD` is unset, pass the comparison base explicitly:

   ```sh
   node --experimental-strip-types scripts/git-status.ts --repository <path> --base origin/main
   ```

3. Use `--refresh` to fetch only the base branch first. Use `--include-remotes`
   to also list `origin/*` remote-tracking branches. Use `--format json` when
   another tool (e.g. `$skill{git-prune}`) consumes the same facts structurally.
   Use `--no-color` or `--format plain` for CI logs or piped output.

## Required Output

A symbol-led table with exact `↑ahead ↓behind` and `+insertions -deletions`
values. State the comparison base and legend.

```
Git branch dashboard  (base: origin/main)

Branch            Upstream              vs base       Diff          Last commit
* feature/example origin/feature/example ↑2 ↓5        +12 -3        2 hours ago   🟠
  main            origin/main           ↑0 ↓0         +0 -0         3 days ago    🟢
  stale-branch    (none)                ↑0 ↓0         +0 -0         2 months ago  ⚪
  gone-upstream   origin/gone-upstream  ↑0 ↓0         +0 -0         1 week ago    🔴

Legend: 🟢 in sync  🟡 ahead only  🔻 behind only  🟠 diverged  🔴 upstream gone  ⚪ no upstream  🌐 remote-tracking
```

Symbols:
- 🟢 in sync (ahead 0, behind 0)
- 🟡 ahead only (unpushed/unmerged commits, behind 0)
- 🔻 behind only (no local commits ahead, stale)
- 🟠 diverged (both ahead and behind)
- 🔴 upstream gone (remote tracking branch deleted on origin)
- ⚪ no upstream (no remote-tracking ref configured)
- 🌐 remote-tracking (origin/* branch, shown with `--include-remotes`)

## Guardrail

The bundled script never deletes, stashes, switches branches, prunes refs, or
contacts the hosting provider. `--refresh` only runs `git fetch origin <base>`.
For any destructive follow-up, invoke `$skill{safeguard}` first.

## Related Skills

- `$skill{git-state}` — worktree + MR/PR merge-classification analysis.
- `$skill{git-prune}` — reuses this script's JSON output to delete stale branches.
- `$skill{safeguard}` — required before any cleanup derived from this dashboard.
