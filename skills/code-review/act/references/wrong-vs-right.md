# Wrong vs right

One-line table of common `/act` mistakes for fast scanning — glance at
this every run. Rules that need a story (git stash hazards, script
runner bypass, review-only PR branches) live in
[`footguns.md`](footguns.md); read it on-demand when about to take a
shortcut.

| Wrong (do not do this) | Right |
|------------------------|--------|
| Run `resolve-open-threads.ts` to clear open threads | Read threads → fix code → reply in thread → then resolve |
| One PR comment "addressed feedback" | Per-thread fix or per-thread reply, then resolve that thread |
| Only touch `.agents/skills/` or the resolve script | Change `apps/`, `tools/`, `specs/`, `packaging/`, workflows per feedback |
| "Merge-ready" because `open_threads=0` | Merge-ready only if feedback is **implemented** and CI green on HEAD |
| Edit PR title/body to track agent progress | Leave author PR summary alone; reply in threads + commits |
| Pass `--record` (or `ACT_RECORD_SCORES=1`) without an explicit decision to grow the dataset | Default OFF; recording opt-in is a deliberate action, not a habit. The scratch JSONL still has the per-run data |
| Mark a failing SAST check green without reading its `annotation_level=failure` entries | Inspect annotations via `gh api repos/<o>/<r>/check-runs/<id>/annotations`; fix or suppress with documented reason before claiming P0 done |
| "SonarCloud is an external service, I don't have access" | Read annotations via `gh api` — they're already on the PR. Check for CLI + env vars. Attempt local reproduction. |
| "Codacy is not my responsibility — it's a third-party tool" | Codacy findings on this PR are your problem. Read annotations, install linter, reproduce, fix. |
| One pass through threads, then resolve | Loop: fetch → analyse → fix → verify → push → re-fetch. CI may surface new findings after each push. |
| Stop when context gets large | Plan a handoff: summarize state, write remaining items to backlog/harvest, report to user. |
| `gh stack rebase && gh stack push` after every single-PR fix | Push only the changed branch. Full-stack push triggers CI on all PRs — see [stack-mode.md](stack-mode.md). |
| Create a `review/<name>` base branch in the same repo to review already-merged `main` commits | Don't. Use a fork (`$skill{shadow-fork}`), run review tools directly on `main`, or use an ephemeral empty branch you delete immediately. Custom base branches go stale and GitHub auto-creates reverse PRs on merge. See [footguns.md](footguns.md#review-only-prs). |
