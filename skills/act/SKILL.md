---
name: act
description: Use when the user invokes /act on a PR/MR, /act with no arguments (uses the PR in the current conversation context), or /act <context> with context ∈ {pr, plan, backlog, harvest, stack}. Resolves threads in product code (or posts a substantive in-thread reply), commits, then closes threads. Never resolve-only. Harvest (collecting threads) lives in /harvest; triage (priority / grouping / wontfix) lives in /backlog. /act is the fix loop, not the collect or triage.
metadata:
  disable-model-invocation: false
  compatibility: Requires gh, jq, git, bun, node.
  tier: 2
  triggers:
    - user
    - model
  allowed-tools:
    - read
    - exec
    - write
    - edit
    - web_search
    - web_get_contents
    - grep
    - message_user
  conflicts_with:
    - github-pr-review
    - review-methodology
  source: ThePlenkov/skills
source: ThePlenkov/skills
---

# /act

**`/act` means fix the PR, not hide review comments.**

Portable skill layout ([agentskills.io](https://agentskills.io/specification)):
`scripts/` (helpers), `references/` (detailed procedures). Copy
`.agents/skills/act/` to relocate.

Applies to `/act`, `/act pr`, `/act stack`, `/act plan`, `/act backlog`,
`/act harvest`, `@claude /act`, `@codex /act`, `@copilot /act`.

**No Playwright** for GitHub PR UI. **`bun` is required** for helper
scripts (runner fallbacks are plain Node.js).

## Philosophy — "It's all yours"

**There is no "not my responsibility" in `/act`.** SonarQube, Codacy,
CodeQL, Semgrep, Trivy — if it flagged something on this PR, it is the
agent's problem to fix. SAST priority ladder and per-tool reproduction:
[`references/sast-source-priority.md`](references/sast-source-priority.md).

## The Loop — iterative, not linear

```
   ┌─── FETCH ───► ANALYSE ───► CONFIRM/REJECT ───┐
   │                                                │
   │   FIX ───► REPLY & RESOLVE ───► VERIFY CLEAN ─┘
   │                                                   │
   └─── PUSH ───► loop back to FETCH                    │
```

| Step | What |
|------|------|
| **FETCH** | PR state — HEAD SHA, check-run status, open threads, SAST annotations |
| **ANALYSE** | Investigate each finding — read annotations, threads, understand what changed |
| **CONFIRM / REJECT** | Is this a real issue? Reject false positives with documented reason |
| **FIX** | Change product code — one logical fix per commit |
| **REPLY & RESOLVE** | Reply pointing to commit, then resolve that thread |
| **VERIFY CLEAN** | `pr-state.ts` → `SAST_FINDINGS_PENDING=0`, `CI_REQUIRED_PENDING=0` |
| **PUSH** | Atomic push with clear commit messages |
| **LOOP** | Re-fetch. New CI may surface new findings. Repeat until clean. |

### Exit conditions — all four must hold on the same HEAD

1. `open_threads == 0`
2. `CI_REQUIRED_PENDING == 0`, `SAST_FINDINGS_PENDING == 0`, `SAST_FINDINGS_UNKNOWN == 0`
3. No new bot comments/annotations since last push (compare before/after)
4. No cycle-guard signal:
   - **Reopened thread** — any thread was resolved earlier then commented on again → stop, do not merge; user must confirm.
   - **Same rule 2+ times** — same rule ID flagged again after a fix commit → verify fix is on current HEAD; do not re-merge blindly.
   - **Empty /act loop** — 2+ `/act` invocations on the same PR with no new product commits → stop and report cycle.

Do not stop at "all threads resolved" if condition 3 fails — bot
re-evaluations after each push commonly open new threads. A clean exit
is usually 3-5 iterations, not 1. Convergence heuristic details:
[`references/loop-convergence.md`](references/loop-convergence.md).

**Context running low?** Plan a handoff: summarize state, write
remaining items to backlog/harvest, report to user. Use subagents for
deep work (SAST investigation, P5 rating) to keep the orchestrator lean.

## Contexts

| Context | Command | Source |
| ------- | ------- | ------ |
| **`pr`** (default) | `/act` · `/act 42` · `/act <url>` | Open threads on a single PR |
| **`stack`** | `/act stack` | All PRs in a stacked branch series — see [Stack mode](#stack-mode) below |
| **`plan`** | `/act plan` | `.agents/plans/*.md` |
| **`backlog`** | `/act backlog` | `.agents/backlog/*.md` |
| **`harvest`** | `/act harvest` | `.agents/review-debt/harvests/*.jsonl` |

`/act` does **not** collect (`/harvest`) or triage (`/backlog`). Pipeline:
`PR merge → /harvest → /backlog → /act → /backlog (archive)`.

Debt context (harvest/backlog) procedure:
[`references/debt-context.md`](references/debt-context.md).

Anti-patterns: [`references/wrong-vs-right.md`](references/wrong-vs-right.md).
Footguns: [`references/footguns.md`](references/footguns.md).

## On start

1. React 👀 on the review to signal the agent has taken it.
2. **Move to draft** (`set-review-state.ts --draft`) to prevent
   reviewers/automation from re-evaluating on every intermediate commit.
3. **Verify environment**: `gh auth status` (GitHub) or
   `GITLAB_TOKEN`/`glab auth status` (GitLab); `jq`, `git`, `curl`,
   `bun` must be available.
4. **Resolve PR/MR context** from number, URL, or `review-state.ts`.
5. **Shadow-fork guard** if repo is a fork — run `shadow-fork-check.sh`.
6. **HEAD SHA** — `review-state.ts` or `gh pr view NUMBER --json headRefOid`.
7. **Inventory threads** — for each unresolved thread: file/line,
   reviewer ask, planned action (fix code | reply only).
   **Use the helper script** (`pr-state.ts` or `review-state.ts`) instead of
   ad-hoc GraphQL — it paginates correctly. If you must query manually, use
   `reviewThreads(last: 100)` (not `first: 100`) to get the **newest** threads,
   and paginate when `totalCount > 100`. `first: 100` returns the oldest
   threads, which are typically already resolved — you will miss new bot
   findings opened after a rebase or push.

Build a **thread plan** before editing. Do not start the resolve script
until every open thread has a planned action and P0a/P0b/P1–P3 are done.

**Never change PR title or description** unless the user explicitly asks.

## Work order — mandatory sequence

| Step | What | Done when |
|------|------|-----------|
| **P0a** | CI / merge blockers on **HEAD** | Required checks green. If blocked by runner limits: [`references/runner-fallback.md`](references/runner-fallback.md) |
| **P0b** | SAST error annotations on failing checks | Every `annotation_level=failure` entry read, fixed, or triaged. Details: [`references/sast-source-priority.md`](references/sast-source-priority.md) |
| **P1** | Blocking review ("must fix", changes requested) | **Code fixed** + **reply in thread** |
| **P2** | Nits, questions, style | **Fix or answer in thread** (not silent) |
| **P3** | Inline suggestions | **Applied in code** or declined with reason **in thread** |
| **P4** | Resolve pass | Only after P0a/P0b/P1–P3 for **all** open threads |
| **P5** | Rate findings (**opt-in**) | Score every finding 0–5. Only if `--record` / `ACT_RECORD_SCORES=1` / config. Details: [`references/RATING_FLOW.md`](references/RATING_FLOW.md) |

**Resolve is step P4, not step 1.**

## Per-thread loop

Runs **inside** each pass of the main loop:

1. **Read** the full thread (all comments).
2. **Acknowledge** with a focused reply on non-trivial findings; add 👀.
3. **Act on substance**: bug → edit product files + run checks;
   question → answer with specifics; suggestion → apply or explain why not.
4. **Commit** product changes (group sensibly; no empty commits).
5. **Reply in thread** pointing to the commit or decision (short, factual).
   Add 👍 when feedback is accepted/fixed.
6. **Then** resolve that thread. **Never resolve a thread that does not
   yet contain an agent reply with the fix commit and evidence.**

Skipping steps 2–5 and only running the batch resolve script
**violates `/act`**.

## What to change

**In scope:** `apps/`, `tools/`, `specs/`, `packaging/`,
`.github/workflows/`, etc.

**Out of scope:** `.agents/skills/`, `resolve-open-threads.ts` — unless
the script literally cannot run.

## Review-only PRs for already-merged work

`/act` operates on an **existing** PR/MR — it is not a tool for
manufacturing review PRs around commits already on `main`. **Never**
invent a custom base branch (e.g. `review/<name>`) in the same repo to
diff against `main`: it goes stale and GitHub auto-creates a reverse
PR on merge. Use a fork (`[shadow-fork](references/shadow-fork/SKILL.md)`), run review tools
directly on `main`, or use an ephemeral empty branch you delete
immediately. Full rationale and the three options:
[`references/footguns.md`](references/footguns.md#review-only-prs).

## Resolve pass (P4)

**Prerequisites:** every open thread has an **in-thread reply** with the
**fix commit SHA and evidence**; auth succeeds.

```bash
# Provider-agnostic
npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/review-resolve.ts --file tmp/open_ids.txt

# GitHub-only legacy (still valid)
npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/resolve-open-threads.ts [--dry-run] OWNER REPO NUMBER
```

The resolve script only clicks "Resolve conversation" — it does **not**
implement fixes. Resolve outdated threads too, but only after the
underlying comment was handled on the branch.

## Merge-ready — the loop has converged

Say **merge-ready** only when **all** are true:

1. Review feedback **done in code** (or explicitly declined with reason).
2. CI required checks **success on current HEAD** (`CI_REQUIRED_PENDING=0`).
3. **SAST clean** — `SAST_FINDINGS_PENDING=0` **and** `SAST_FINDINGS_UNKNOWN=0`.
4. `open_threads=0`.
5. Summary lists **what you changed per theme/file**, not just "resolved N threads".
6. **P5 done** (if opted in) — scratch report written; CSV only when recording enabled.
7. **Move out of draft** (`set-review-state.ts --ready`) — final step.

**If the loop is still producing new findings on each push, it has not
converged.** Keep iterating. If context is low, hand off.

## PR closing summary

1. Status · 2. **HEAD** SHA · 3. **Review fixes** (per theme/file) ·
4. Threads resolved · 5. CI on HEAD · 6. SAST clean · 7. P5 (if opted in) ·
8. Left

## Stack mode

When the user invokes `/act stack` or the PR is part of a stacked branch
series (`gh stack` or equivalent). Full procedure:
[`references/stack-mode.md`](references/stack-mode.md).

### Core logic: bottom-to-top, round-robin, don't wait for CI

```
PR #1 (bottom) → PR #2 → PR #3 → ... → PR #N (top)
  fix & push      fix & push  fix & push    fix & push
       │              │            │              │
       ▼              ▼            ▼              ▼
     CI runs        CI runs      CI runs        CI runs
     (async)        (async)      (async)        (async)
       │              │            │              │
       └──────────────┴────────────┴──────────────┘
                      │
              round-robin: re-scan
              for new bot comments
              from bottom to top
```

**Key insight: don't block on CI.** After pushing PR #1, immediately
move to PR #2 to analyze and fix while CI runs on #1. CI is async —
your analysis isn't. By the time you've fixed PR #5, CI on PR #1 is
done and you can check it on the round-robin pass. This turns serial
wait-for-CI into parallel analysis.

### Rules

1. **Process bottom-to-top** — fix the lowest PR first. Everything
   above inherits its changes.
2. **Push only what changed** — never push a branch whose HEAD SHA
   hasn't changed. Check `git rev-parse <branch>` vs
   `git rev-parse origin/<branch>`. Full-stack push (`gh stack push`)
   only when the stack base changed or a lower commit altered
   downstream diffs.
3. **Don't wait for CI between PRs** — push, then move to the next PR.
   Check CI results on the round-robin re-scan.
4. **Round-robin** — after reaching the top, re-scan from the bottom
   for new bot comments or CI findings. The first pass fixes 80-90%
   of threads; subsequent passes catch bot re-evaluations on the new
   diffs. Usually 2-3 round-robin passes converge the whole stack.
5. **Analyze all PRs at once** — fetching all thread states upfront
   (before fixing anything) lets you see patterns across PRs and batch
   similar fixes. This is more efficient than processing each PR in
   isolation.

### Stack convergence

All PRs are merge-ready when every PR has: `open_threads=0`,
`CI_REQUIRED_PENDING=0`, `SAST_FINDINGS_PENDING=0`,
`SAST_FINDINGS_UNKNOWN=0`, no new bot comments since the last push,
and `mergeable_state` is `clean` or `unstable` (not `conflict` or `dirty`).

Push optimization details, conflict resolution, and CI waiting
strategy: [`references/stack-mode.md`](references/stack-mode.md).

## Idempotency

If feedback is already fixed on HEAD and threads are closed → short
"already done", no resolve-only rerun.

## Validation

`bunx nx format:write` on touched `tools/**/*.ts` before commit.

## Token-rationalized workflow

Use helpers under [`scripts/`](scripts/) instead of ad-hoc `gh`/`glab`
calls. Index: [`references/script-index.md`](references/script-index.md).
Gotchas: [`references/script-gotchas.md`](references/script-gotchas.md).

## Runtime extras

- **Copilot SWE:** .github/copilot-instructions.md
- **Codex / Claude:** AGENTS.md § Cloud agents on GitHub
