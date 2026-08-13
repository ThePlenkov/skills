---
name: act
description: Use when the user invokes /act on a PR/MR, /act with no arguments (uses the PR in the current conversation context), or /act <context> with context ∈ {pr, plan, backlog, harvest}. Resolves threads in product code (or posts a substantive in-thread reply), commits, then closes threads. Never resolve-only. Harvest (collecting threads) lives in /harvest; triage (priority / grouping / wontfix) lives in /backlog. /act is the fix loop, not the collect or triage.
---

# /act

Portable skill layout ([agentskills.io](https://agentskills.io/specification)):
`scripts/` (helpers), `references/` (EVALUATE, RATING_FLOW,
SAST-source-priority). Copy `.agents/skills/act/` to relocate.

**`/act` means fix the PR, not hide review comments.**

Applies to `/act`, `/act pr`, `/act plan`, `/act backlog`, `/act harvest`,
`/act ... --runner`, `@claude /act`, `@codex /act`, `@copilot /act`.

**No Playwright** for GitHub PR UI.

**`bun` is required** for most helper scripts (e.g. `Bun.spawnSync`,
`bun:test`, `#!/usr/bin/env bun`). The runner fallback scripts
(`scripts/runner.cjs` and `scripts/cleanup-runner.cjs`) are plain Node.js
so they work on hosts without `bun`. Install `bun` first if it is
missing.

## Philosophy — "It's all yours"

**There is no "not my responsibility" in `/act`.** SonarQube, Codacy,
CodeScene, CodeQL, Semgrep, Trivy — these are not external services the
agent can dismiss. They are part of the code quality surface, and
`/act` owns all of it. If a SAST tool flagged something on this PR, it
is the agent's problem to fix.

**Priority ladder for SAST findings** (check in this order): GitHub CI
run annotations (primary) → SARIF artifacts (secondary) → CLI with
env vars (tertiary) → install and run locally (last resort). **Never
skip step 1.** "I don't have access to SonarCloud" is wrong — the
annotations are already on the PR via GitHub's check-runs API.

The full step-by-step (annotation reads, SARIF fallback, CLI
enumeration, per-tool reproduction) lives in
[`references/sast-source-priority.md`](references/sast-source-priority.md).

## The Loop — `/act` is iterative, not linear

`/act` is not a one-pass code review. It is an **end-to-end iterative
loop** that runs until the PR is clean:

```
   ┌─── FETCH ───► ANALYSE ───► CONFIRM/REJECT ───┐
   │                                                │
   │   FIX ───► REPLY & RESOLVE ───► VERIFY CLEAN ─┘
   │                                                   │
   └─── PUSH ───► loop back to FETCH                    │
```

| Step | What |
|------|------|
| **FETCH** | Get current PR state — HEAD SHA, check-run status, open threads, SAST annotations |
| **ANALYSE** | Investigate each finding — read annotations, read threads, understand what changed and why |
| **CONFIRM / REJECT** | Is this a real issue? Reject false positives with documented reason |
| **FIX** | Change product code — one logical fix per commit, grouped sensibly |
| **REPLY & RESOLVE** | Per-thread response + resolve — reply pointing to commit, then resolve that thread |
| **VERIFY CLEAN** | `pr-state.ts` → `SAST_FINDINGS_PENDING=0`, `CI_REQUIRED_PENDING=0` |
| **PUSH** | Atomic push with clear commit messages |
| **LOOP** | Re-fetch state. New CI run may surface new findings. Repeat until clean. |

**There is no arbitrary iteration limit.** The loop runs until the PR
is merge-ready or the context window is full. If context is running
low, stop and **plan a handoff** (see below) instead of rushing to
merge.

**Code review is one step in the loop, not the whole loop.** P0a/P0b
(CI/SAST) and P1–P3 (review threads) are all part of the same
iterative cycle. The agent does not "finish code review" and then
"handle CI" — it does everything in each pass, because a fix may
trigger new CI findings.

### `/act --loop` — keep the loop running until it converges

`/act --loop` (or `/act` with no further context) is the default.
The loop does NOT terminate on the first clean pass — it terminates
only when **all four** are true on the same HEAD:

1. `open_threads == 0` from `review-state.ts` showing `OPEN_THREADS=0`.
2. `CI_REQUIRED_PENDING == 0`, `SAST_FINDINGS_PENDING == 0`, and
   `SAST_FINDINGS_UNKNOWN == 0`.
3. No new comments / annotations appeared in the last CI run
   (compare bot-comment count before and after the most recent
   push; if it grew, the bots are still finding things and the
   loop is not converged).
4. No cycle-guard signal (P6) fires on this iteration.

Until those four are met, **wait for CI, re-fetch threads, and
reiterate.** Do not stop at "all threads resolved" if step 3 fails
— bot re-evaluations after each push commonly open new threads
on the new diff, and a resolve pass that doesn't re-fetch is a
false convergence. Use a background poll on the actions endpoint
(or a `gh run watch`) to block until CI completes, then re-run
the FETCH step.

**The four conditions are the exit rule.** There is no second,
parallel exit rule. The "stability" / "convergence heuristic"
below is a way to verify that conditions 3 and 4 are stable
across iterations, not a separate way to leave the loop. An agent
that exits after two stable iterations without satisfying all
four is wrong.

Stability check (a way to verify conditions 3 and 4, not an
independent exit): if the current iteration's push produced zero
new bot comments AND zero new bot findings/annotations and no new
required-check failures compared to the previous HEAD, the loop
is stable for this iteration. (Compare findings and check
outcomes, not raw check-run objects — every push spawns fresh
check-run objects, so counting them would never reach zero.) The full exit still
requires conditions 1 and 2 to also hold. In practice, three
consecutive stable iterations is a strong signal that no further
bot findings are coming, because the bots have evaluated the
final state and the new diffs are small enough that the same
rule won't fire again. But stability alone is never sufficient
— `open_threads == 0` and the CI/SAST zeros are still required.

**Common pattern observed in practice** (so the agent does not
mistake it for a stuck loop): the first push resolves 80-90% of
threads, the second push resolves the bot re-evaluations on the
iteration-1 fixes (the "iteration-2 catch"), the third push
resolves the bot re-evaluations on the iteration-2 fixes (the
"iteration-3 catch"), and so on. Each iteration shrinks the
remaining set but typically does not zero it. A clean exit is
usually 3-5 iterations, not 1.

### Context management and handoff

When the context window is approaching capacity: stop the loop,
summarize current state, write a handoff file (PR comment for PR
context; `.agents/review-debt/harvests/` or `.agents/backlog/`
entries for batch context), then report to user with "PR is at
[state]. Remaining: [list]. Recommend running `/act` again to
continue."

### Subagents for context preservation

Use subagents when the main `/act` context is getting large and you
need to perform a sub-task without consuming the orchestrator's
context window. P5 (rating) → `general` subagent; large SAST
investigation → `investigator` subagent; batch debt processing →
parallel subagents per group. The orchestrator stays lean — it
fetches state, plans, dispatches, and integrates results. Subagents
do the deep work and return status.

## Contexts

`/act <context>` resolves threads from one of four sources and
produces one PR:

| Context | Command | Source | Owner |
| ------- | ------- | ------ | ----- |
| **`pr`** (default when a PR is in context) | `/act` · `/act pr` · `/act 42` · `/act <url>` | Open threads on a single PR | Live PR |
| **`plan`** | `/act plan` | `.agents/plans/*.md` | `/plan` (future) |
| **`backlog`** | `/act backlog` | `.agents/backlog/*.md` | `/backlog` |
| **`harvest`** | `/act harvest` | `.agents/review-debt/harvests/*.jsonl` | `/harvest` |

Every `<context>` other than `pr` must `resolve by pr | branch` —
each row in the source is keyed by a PR number (or branch name) and
a thread id; `/act` then opens **one** batch PR that lists the source
identifiers and fixes the threads in product code.

`/act` does **not** collect (`/harvest`) or triage (`/backlog`). The
three skills form a one-way pipeline:

```
PR merge → /harvest → /backlog → /act → /backlog (archive)
```

If a thread is on the live PR you're running `/act pr` against, fix
it directly. If it's in `harvests/*.jsonl`, run `/act harvest` (or
its alias `/act debt`). If it's in `.agents/backlog/*.md`, run
`/act backlog`.

### `/act debt` (alias for `harvest`)

`/act debt` is a deprecated alias for `/act harvest`. It is **not**
a separate mode; the scripts under `bun run act:debt:*` resolve to
the harvest-style batch PR.

Common `/act` anti-patterns and the right alternatives: [references/wrong-vs-right.md](references/wrong-vs-right.md).

Long-tail footguns are catalogued in [`references/footguns.md`](references/footguns.md). Read it when about to take a shortcut.

## PR metadata

**Never change pull request title or description** unless the user
explicitly asks.

Do not replace the author's summary with checklists, thread counts,
or CI notes. On GitHub Copilot, repository rules live in
.github/copilot-instructions.md and
.github/instructions/act.instructions.md.

## On start

1. React 👀 (or 👍) on the review to signal the agent has taken it.
2. **Move the PR/MR to draft** if it is not already. This prevents
   reviewers and automation from re-evaluating the branch on every
   intermediate commit while the agent is actively fixing feedback.
   Use `set-review-state.ts --draft`.
3. **Verify environment preconditions** before any state work:
   - GitHub: `gh auth status` must succeed (request `GH_TOKEN` and stop if
     missing/invalid); network allowlist must include `api.github.com`
     and `github.com`.
   - GitLab: `GITLAB_TOKEN` (or `glab auth login`) must be available; the
     remote host (`gitlab.com` or self-managed) must be reachable.
   - Both: `jq`, `git`, `curl`, and `bun` must be available (install `bun`
     first — the helper scripts require it).
   - Override auto-detection with `ACT_PROVIDER=github|gitlab` or
     `GITLAB_HOST=gitlab.example.com` when needed.
4. **Resolve the PR/MR context** from a number, URL, or
   `pr-from-context.sh` / `review-state.ts` (the most recently updated
   open review for the current branch). If ambiguous, ask the user before
   proceeding.
5. **Shadow-fork guard (PR/MR context only).** If the repo is a fork
   and the PR/MR base is the default branch, run `shadow-fork-check.sh`
   before any rebase/merge/conflict resolution. Stop and clarify
   scope on exit `20` (fork `main` ahead of upstream) or `21`
   (diverged). Exit `0` means the fork is equal or already
   fast-forwarded.
6. **HEAD SHA** — `review-state.ts` (resolves the review from context,
   works on GitHub and GitLab) or `gh pr view NUMBER --json
   headRefOid,statusCheckRollup,url` for GitHub.
7. **Inventory threads** — for each unresolved thread/discussion, capture:
   file/line, reviewer ask, code change vs written answer.

Build a short **thread plan** before editing:

```
Thread 1 (path: …): [fix code | reply only] — what you will do
Thread 2 …
```

Do not start the resolve script until every open thread has a planned
action and you have executed P0a / P0b / P1–P3.

## Debt context (`/act harvest`, `/act debt`, `/act backlog`)

Use after a `/harvest` cycle (or after `/backlog` triage has written
`.agents/backlog/*.md`) and you want to fix many threads in one batch
PR.

| Step | What | Done when |
| ---- | ---- | --------- |
| **D0** | Load queue | `bun run act:debt:query -- --status open --limit N --format tsv` (harvest) or read `.agents/backlog/*.md` (backlog) |
| **D1** | Thread plan | Group by `area` / file; note `source_pr` + `thread_id` per row |
| **D2** | Branch | `cursor/<context>-YYYY-MM-DD-f7a9` |
| **D3** | Fix | Product code in `apps/`, `tools/`, `specs/`, … |
| **D4** | Verify | Same verify block as PR context where applicable |
| **D5** | PR | Title lists source PRs; body maps themes → commits |
| **D6** | Close loop | `bun run act:debt:done -- --status done --fix-pr N --threads-file …` |
| **D7** | Resolve | `resolve-open-threads.ts` on source PRs only after reply + fix |

Batch PR **merge-ready:** CI green on HEAD
(`CI_REQUIRED_PENDING=0` AND `SAST_FINDINGS_PENDING=0`) + summary of
themes fixed. Do **not** require `open_threads=0` on source PRs before
the batch PR merges.

After the batch PR merges, run `bun run harvest:archive` (or
`/backlog harvest`) so the harvest file is moved out of `harvests/`.

## Work order — PR/MR context (mandatory sequence)

| Step | What | Done when |
|------|------|-----------|
| **P0a** | CI / merge blockers on **HEAD** | Required checks green on **current** HEAD (passing **and** failing-blockers resolved). If checks are blocked by runner limits or the user requested `/act ... --runner`, start a local self-hosted runner, re-run checks, and watch them with `gh` (see [`references/runner-fallback.md`](references/runner-fallback.md)) |
| **P0b** | SAST error annotations on failing checks | For each FAILING SAST check, the agent has read every annotation_level=`failure` entry via `gh api repos/<owner>/<repo>/check-runs/<id>/annotations`, fixed in code or triaged with a documented reason (NOSONAR / suppression / false-positive link) |
| **P1** | Blocking review ("must fix", changes requested) | **Code fixed** on branch + **reply in that thread** |
| **P2** | Nits, questions, style | **Fix or answer in thread** (not silent) |
| **P3** | Inline suggestions | **Applied in code** or declined with reason **in thread** |
| **P4** | Resolve pass | Only after P0a / P0b / P1–P3 for **all** open threads |
| **P5** | Rate findings (research, opt-in) | Every check-run + review finding scored 0–5 in `tmp/agent_<pid>/scores-report.jsonl` (always); `review_scores.csv` only when explicitly opted in ([RATING_FLOW.md](references/RATING_FLOW.md)) |
| **P6** | Evaluation | Retrospect, update durable knowledge, cycle check — **before** merge-ready |

### P0a — CI green, no merge blockers

`review-state.ts` (or `pr-state.ts` on GitHub) reports
`CI_REQUIRED_PENDING=N` for the **required** checks / pipeline that
are blocking. Treat every non-AI-reviewer failing check as P0: green
it locally, push, or document why it cannot be fixed in this review.

#### CI blocked by runner limits or `/act ... --runner`

If a failing/pending check annotation contains:

```
The job was not started because recent account payments have failed or your
spending limit needs to be increased.
```

or the user explicitly requested `--runner`, `/act` must start a local
self-hosted runner for the repo, re-run the blocked checks, and watch them to
completion.

1. Confirm `gh auth status` and the token can request a runner registration token.
2. Ask the user for approval via `message_user` before running arbitrary workflow
   code on the host.
3. Temporarily route `.github/workflows` to self-hosted labels matching the host
   (commit this change so it can be reverted).
4. Start the runner in the background:
   ```bash
   RUNNER_TOKEN=$(gh api --method POST repos/<owner>/<repo>/actions/runners/registration-token --jq '.token')
   node scripts/runner.cjs --owner <owner> --repo <repo> --token "$RUNNER_TOKEN" --work-dir tmp/act-runner --persistent --detach --pid-file tmp/act-runner.pid
   ```
5. Re-run the latest failed run or push an empty commit to trigger checks.
6. Watch the queued runs:
   ```bash
   RUN_ID=$(gh run list --repo <owner>/<repo> --branch <branch> --json databaseId --jq '.[0].databaseId')
   gh run watch "$RUN_ID" --repo <owner>/<repo>
   ```
7. After the checks finish, stop the runner and clean up:
   ```bash
   node scripts/cleanup-runner.cjs --owner <owner> --repo <repo> --work-dir tmp/act-runner --pid-file tmp/act-runner.pid
   git revert <routing-commit-sha>
   ```

Full details and platform-specific notes are in
[`references/runner-fallback.md`](references/runner-fallback.md).

### P0b — Critical SAST error annotations (obligatory for failing checks)

When a required check / pipeline job fails from a **SAST tool**, the
failing run is not the whole story. The agent **must** read every
`annotation_level=failure` entry on GitHub (the inline
`::error file=…line=…::…` annotations) or the equivalent failed-job
log / security report on GitLab, then for each one: fix in product code
(preferred), suppress with documented reason
(`// NOSONAR` / `// nosemgrep` / `# noqa` / `// @ts-ignore` — never
whole-file), or open an issue / backlog item and link it in the
in-thread reply. The full procedure and per-tool reproduction
commands are in
[`references/sast-source-priority.md`](references/sast-source-priority.md).

`review-state.ts` / `pr-state.ts` surfaces this as
`SAST_FINDINGS_PENDING=N` — count of `annotation_level=failure`
entries on **failing** SAST runs (zero extra calls when CI is fully
green). On GitLab, inspect the `PIPELINE_STATUS` and any failed job
logs for SAST/security output.

**Resolve is step P4, not step 1.**
**P6 is mandatory before merge-ready** on every `/act` (cycle check +
checklist); the **retrospective** portion is required only when
something went wrong during the session (see
[EVALUATE.md](references/EVALUATE.md)).
If you cannot fix something in-repo, say so **in that thread**; do
not resolve it without a visible reply.

## Per-thread loop

The per-thread loop runs **inside** each pass of the main loop. One
pass of the main loop processes all open threads, then re-fetches
state to see if CI has surfaced new findings.

1. **Read** the full thread (all comments).
2. **Acknowledge** with a focused reply when you start work on a
   non-trivial finding; add an 👀 reaction to the reviewer note if the
   platform supports it.
3. **Act on substance**: bug/design/correctness → edit product files
   and run relevant checks; question → answer in the thread with
   specifics; suggestion → apply diff or explain why not.
4. **Commit** product changes (group sensibly; no empty commits).
5. **Reply in the thread** pointing to the commit or your decision
   (short, factual). Add a 👍 reaction to the reviewer note when the
   feedback is accepted/fixed, or the appropriate disposition reaction
   for pushback.
6. **Then** mark that thread/discussion resolved (see P4). **Never
   resolve a thread that does not yet contain an agent reply with the
   fix commit and evidence, even if the review platform auto-resolved it.

Skipping steps 2–5 and only running the batch resolve script
**violates `/act`**. After all threads are processed, re-fetch state
(`review-state.ts` for GitHub and GitLab); new CI findings may have
appeared from the last push. Start the main loop again.

## What to change

**In scope:** `apps/`, `tools/`, `specs/`, `packaging/`,
`.github/workflows/`, etc.

**Out of scope for "addressing review":** `.agents/skills/`,
`resolve-open-threads.ts` — unless the script literally cannot run
(`npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/resolve-open-threads.ts --dry-run`
fails).

## Resolve pass (P4 only)

**Prerequisites:** every open thread/discussion has an **in-thread reply**
from the agent containing the **fix commit SHA and evidence**; `gh auth status`
(GitHub) or `GITLAB_TOKEN`/`glab auth status` (GitLab) succeeds. If a thread
was auto-resolved by the review platform or another bot, the agent must still
post the evidence reply before calling `review-resolve.ts`.

Provider-agnostic:

1. Run `review-state.ts` and read the `OPEN_THREADS_TABLE:` section.
2. Extract the first column (the thread/discussion global ID) from each row
   and write one ID per line to `tmp/open_ids.txt` using a Node script or
   file tool.
3. Resolve them:

```bash
npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/review-resolve.ts --file tmp/open_ids.txt
```

GitHub-only legacy helper (still valid):

```bash
npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/resolve-open-threads.ts --dry-run OWNER REPO NUMBER
npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/resolve-open-threads.ts OWNER REPO NUMBER
# Final verification dry-run: must report open_threads=0 before the PR is merge-ready
npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/resolve-open-threads.ts --dry-run OWNER REPO NUMBER
```

The resolve script only clicks "Resolve conversation" / "Resolve
discussion" — it does **not** implement review fixes. Resolve outdated
threads too, but only after the underlying comment was handled on
the branch.

## Rate findings (P5 — research dataset, **opt-in**)

After P4, score every tool finding (check-run annotations + inline
review comments) 0–5 so we can measure which review tools earn their
slot. The agent only judges; the scripts do the fetch/join/CSV work
in two tool calls. Full contract:
[RATING_FLOW.md](references/RATING_FLOW.md).

**CSV recording is OFF by default.** Per-run data is captured (JSONL
scratch under `tmp/agent_<pid>/` — gitignored, automatically
garbage-collected); only the persistent
`.agents/act/review_scores.csv` upsert is gated. Opt in via any of:
`… --record` (CLI), `ACT_RECORD_SCORES=1` (env),
`.agents/act/config.json` `{"record_scores": true}` (file).
Priority: `--record` > `ACT_RECORD_SCORES` > config file > default
OFF.

## Evaluation (P6 — after P5, before merge-ready)

Follow [EVALUATE.md](references/EVALUATE.md) for the full
checklist (session retrospective, cycle detection, SAST error
annotations, efficiency regression, durable knowledge, and the
two-surface P6 split — PR comment vs memory). Durable sinks:
REVIEW.md (workflow-level) and `.memory/experience/` (process /
skill-level). The cycle-guard signals (reopened threads, duplicate
rule flags, empty `/act` loop) are listed in P6 of the Work order;
if any fires, **do not merge**, escalate to the user with evidence.
Fix counts must be named with their source system and queried on
**current HEAD**.

The two-surface P6 split — what goes on the PR comment vs what
goes to memory — is documented in detail in
[EVALUATE.md § 5](references/EVALUATE.md#5-p6-has-two-surfaces--keep-them-separate)
and that is the canonical source. This SKILL.md gives the
short version: **PR comment is for the merge-decision inputs only
(HEAD, CI, threads, in-scope, pointer to memory); everything else
(iteration log, P5 ratings, retrospective reasoning, cycle-guard
diagnostic, process lessons) lives in memory.**

### Cycle-guard signal: `reopened threads`

The cycle signal is a thread that was previously resolved and is
now unresolved **without any new commit since it was resolved**
(i.e. reopened on the *same* HEAD SHA). That is what the guard
escalates on. A thread the bot reopens on a **later** SHA (after
a fix commit) is normal re-evaluation, not a cycle — feed it into
the next iteration's FIX step and do not block or escalate on it.

**Input source.** This signal is not computable from a single
`pr-state.ts` call — that helper deliberately reports only the
*current* `HEAD_SHA` and `OPEN_THREADS`. The guard compares that
snapshot against the resolved-thread state the agent observed
**earlier in this `/act` run** (its iteration memory, including
state restored when resuming *and reconciled with all PR thread
activity since the checkpoint*): a thread it saw resolved at HEAD
`X`, now unresolved while HEAD is still `X`. Restored state that
has not been reconciled with intervening review activity does not
count as a prior observation — a reopen may have happened after
the checkpoint. If no reconciled prior observation is available
(e.g. first iteration, or a resumed session whose restored history
can't be reconciled), the cycle-guard status is **unknown** — do
not declare P6 passed. Reconstruct the thread's resolved HEAD
(from PR timeline / review history) or escalate to the user before
claiming merge-ready.

The most common causes of a genuine same-SHA reopen, in order of
frequency:

1. **Fix did not actually land.** The fix commit was pushed but
   the file content at the line the bot is pointing at is still
   the old text (e.g. the edit was reverted, or the file was
   overwritten by a merge). Re-check the file content against
   the bot's quoted line, then re-fix.
2. **A genuine new issue.** The bot re-evaluated and found a
   real, separate issue that the previous fix exposed (e.g.
   removing a workaround revealed a deeper bug). This is a
   real new P1/P2 and must be triaged normally.

(Bot re-evaluation on a **new diff** at the same line looks
similar but is expected: `isResolved` flips to `false`
automatically when the bot re-runs on a later HEAD. Address the
finding in the next FIX step; it is not a same-SHA cycle.)

When a cycle-guard fires, do not declare merge-ready. Either
keep iterating (if `/act --loop` is in effect) or escalate to
the user with the thread ID, the bot's quoted line, the current
file content at that line, and a one-line diagnosis of which of
the two causes above is at play.

## Merge-ready — the loop has converged

Say **merge-ready** only when all of these are true:

1. Review feedback is **done in code** (or explicitly declined in
   threads with reason).
2. CI required checks **success on current HEAD**
   (`CI_REQUIRED_PENDING=0`).
3. **SAST findings clean** — `SAST_FINDINGS_PENDING=0` **and**
   `SAST_FINDINGS_UNKNOWN=0`; every `annotation_level=failure` on a
   failing SAST check is fixed, suppressed with reason, or triaged
   to backlog (P0b). A non-zero `SAST_FINDINGS_UNKNOWN` means the
   annotations probe failed for some check — coverage is unknown, so
   re-run `review-state.ts` (or read the annotations manually) until it
   is zero; never claim SAST clean while any check is unverified. On
   GitLab, inspect the `PIPELINE_STATUS` and any failed job logs for
   security findings.
4. `open_threads=0` from `review-state.ts` showing `OPEN_THREADS=0`.
5. Summary lists **what you changed per theme/file**, not only
   "resolved N threads".
6. **P5 done** — per-run scratch report written; persistent
   `review_scores.csv` only updated when opted in (when recording IS
   enabled, the row must be committed on the PR/MR branch). Delegate to
   a `general` subagent with the `--evaluator` value as the model
   name. One `findings.jsonl` per `/act` run — do NOT re-extract
   findings after scoring begins.
7. **P6 passed** — no cycle signals (reopened threads, duplicate
   rule flags, empty `/act` loop); retrospective + sink update done
   if anything went wrong this session.
8. **Move the PR/MR out of draft** to ready for review with
   `set-review-state.ts --ready`. This is the final step so external
   reviewers and automation only see the branch once it is clean.

**If the loop is still producing new findings on each push, it has
not converged.** Keep iterating. If context is running low, hand off
instead of rushing.

## PR closing summary

1. Status
2. **HEAD** SHA
3. **Review fixes** (bullet per theme / file — main section)
4. Threads: how many resolved **after** fixes; `open_threads=0`
5. CI on HEAD (`CI_REQUIRED_PENDING=0`)
6. **SAST (P0b):** `SAST_FINDINGS_PENDING=0`; for each prior
   `failure` annotation, what changed (fixed / suppressed / backlog
   link)
7. **P5:** findings rated (N rows in scratch; M rows committed to
   `review_scores.csv` iff recording was opted in this run)
8. **P6:** cycle signals (none / blocked — list)
9. Left

## Idempotency

If feedback is already fixed on HEAD and threads are closed → short
"already done", no resolve-only rerun.

## Validation

`bunx nx format:write` on touched `tools/**/*.ts` before commit.

## Token-rationalized workflow

Use the helpers under [`scripts/`](scripts/) instead of issuing ad-hoc `gh`/`glab` calls. See [references/script-index.md](references/script-index.md) for the per-step command index and [`references/script-gotchas.md`](references/script-gotchas.md) for scratch-artifact rules.

## PR stacks (`/act stack`)

When the user invokes `/act stack`, `/act pr stack`, or the PR is part
of a stacked branch series (managed by `gh stack` or equivalent), the
loop runs **bottom-to-top, round-robin**, but with **stack-aware push
optimization** to avoid wasting CI minutes.

See [`references/stack-mode.md`](references/stack-mode.md) for the full
procedure. Short version:

1. **Discover the stack** — `gh stack view` (or `gh stack list`) to get
   the ordered list of branches and PR numbers, bottom to top.
2. **Process bottom-to-top** — start from the lowest PR in the stack.
   Run the normal `/act` loop (P0a–P6) on each PR before moving up.
3. **Push only what changed** — after fixing a PR, push **only that
   branch** (`git push origin <branch>`) and any **downstream branches
   that need rebasing**. Do **not** blindly run `gh stack push` (which
   pushes all branches) unless the bottom of the stack changed.
4. **Rebase only when needed** — if a lower-stack commit changed the
   diff that downstream branches build on, rebase downstream branches
   with `gh stack rebase` (or manual `git rebase`). If only the top
   branch changed, push just that branch — no rebase needed.
5. **Wait for CI per-PR** — after each push, wait for CI on the
   **pushed branches only**. Do not wait for CI on branches whose HEAD
   SHA did not change.
6. **Round-robin** — after reaching the top, re-scan from the bottom
   for any new bot comments or CI findings that appeared from the
   latest pushes. Repeat until all PRs are merge-ready.

### Stack push optimization — the key rule

**Never push a branch whose HEAD SHA has not changed.** Before running
`gh stack push` (or any bulk push), check which branches have new
commits:

```bash
# Show local vs remote for each stack branch
for branch in $(gh stack list --format 'json' | jq -r '.[].branch'); do
  local_sha=$(git rev-parse "$branch" 2>/dev/null)
  remote_sha=$(git rev-parse "origin/$branch" 2>/dev/null)
  if [ "$local_sha" != "$remote_sha" ]; then
    echo "CHANGED: $branch"
  fi
done
```

Push only the `CHANGED` branches. If a branch was rebased (its history
changed even without new commits), it will appear as `CHANGED` — that
is correct, it needs a force-push.

**Anti-pattern:** running `gh stack rebase && gh stack push` after
every fix, even when only the top branch was edited. This triggers CI
on all 10+ PRs in the stack, wasting runner minutes and creating noise
from bot re-evaluations on unchanged diffs.

### When to rebase the whole stack

Rebase the full stack (`gh stack rebase && gh stack push`) **only when**:

- The bottom branch (`main` or the stack base) received new commits.
- A lower-stack PR's changes conflict with or alter the diff that
  downstream branches depend on.
- The user explicitly asks for a full stack refresh.

In all other cases, push only the changed branch(es).

## Runtime extras

- **Copilot SWE:** .github/copilot-instructions.md
- **Codex / Claude:** AGENTS.md § Cloud agents on GitHub
