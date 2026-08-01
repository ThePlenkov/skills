# Wrong vs right

Common mistakes when running `/act` and what to do instead.

| Wrong (do not do this) | Right |
|------------------------|--------|
| Run `resolve-open-threads.sh` to clear open threads | Read threads → fix code → reply in thread → then resolve |
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

Long-tail footguns (git stash / `git add -A` / `scripts/run.ts` bypass / "what's the PR?" mid-flow) are catalogued in [`references/footguns.md`](references/footguns.md). Read it when about to take a shortcut.
