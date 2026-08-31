---
name: act
description: Use when the user invokes /act on a PR/MR, /act with no arguments (uses the PR in the current conversation context), or /act <context> with context ∈ {pr, plan, backlog, harvest, stack}. Resolves threads in product code (or posts a substantive in-thread reply), commits, then closes threads. Never resolve-only. /act is the fix loop — collection lives in /harvest and triage in /backlog.
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

**Leave the author's PR title and body as-is** unless the user explicitly
asks for a change; track agent progress in thread replies and commits.

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
6. **Then** resolve that thread. **Resolve only after the thread holds
   an agent reply with the fix commit and evidence** — resolve-before-reply
   is the cardinal `/act` violation.

Skipping steps 2–5 and only running the batch resolve script
**violates `/act`**.

## What to change

**In scope:** `apps/`, `tools/`, `specs/`, `packaging/`,
`.github/workflows/`, etc.

**Out of scope:** `.agents/skills/`, `resolve-open-threads.ts` — unless
the script literally cannot run.

## Review-only PRs for already-merged work

`/act` operates on an **existing** PR/MR — it reviews an open PR, not
commits already on `main`. To get automated review on already-merged
work, use one of: a fork (`[shadow-fork](references/shadow-fork/SKILL.md)`) with a fork→upstream
PR, review tools run directly on `main` (Codacy, CodeQL, Semgrep, and
Trivy can scan commits without a PR), or an ephemeral empty branch you
delete immediately after review. Inventing a custom base branch
(`review/<name>`) in the same repo is the anti-pattern to avoid: it
goes stale and GitHub auto-creates a reverse PR on merge. Full
rationale: [`references/footguns.md`](references/footguns.md#review-only-prs).

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
series (`gh stack` or equivalent). The stack is processed bottom-to-top
with two efficiency levers — **don't wait for CI between PRs** (push,
then move on; check CI on the round-robin re-scan) and **analyze all PRs
upfront** to batch similar fixes. Convergence is 2-3 round-robin passes,
not N serial iterations. Full procedure, push optimization, conflict
resolution, and the per-PR convergence check:
[`references/stack-mode.md`](references/stack-mode.md).

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
