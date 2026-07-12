---
name: act
description: >-
  Use when the user invokes /act on a PR/MR, /act with no arguments
  (uses the PR in the current conversation context), or /act <context> with
  context ∈ {pr, plan, backlog, harvest}. Resolves threads in product code
  (or posts a substantive in-thread reply), commits, then closes threads.
  Never resolve-only. Harvest (collecting threads) lives in /harvest;
  triage (priority / grouping / wontfix) lives in /backlog. /act is the
  fix loop, not the collect or triage.
disable-model-invocation: true
compatibility: Requires gh, jq, git, bun.
---

# /act

Portable skill layout ([agentskills.io](https://agentskills.io/specification)): `scripts/` (helpers), `references/` (EVALUATE, RATING_FLOW). Copy `.agents/skills/act/` to relocate.

**`/act` means fix the PR, not hide review comments.**

Applies to `/act`, `/act pr`, `/act plan`, `/act backlog`, `/act harvest`, `@claude /act`, `@codex /act`, `@copilot /act`.

**No Playwright** for GitHub PR UI.

## Philosophy — "It's all yours"

**There is no "not my responsibility" in `/act`.** SonarQube, Codacy, CodeScene, CodeQL, Semgrep, Trivy — these are not external services the agent can dismiss. They are part of the code quality surface, and `/act` owns all of it. If a SAST tool flagged something on this PR, it is the agent's problem to fix.

**Priority ladder for SAST findings** (check in this order):

1. **GitHub CI run annotations** — the primary source. Most SAST tools leave inline `::error` / `::warning` annotations on the PR via check-runs. Read these first via `gh api repos/<o>/<r>/check-runs/<id>/annotations`. This is faster and more reliable than SARIF.
2. **SARIF files** — secondary. Some tools (CodeQL, Snyk, Trivy) produce SARIF artifacts. Download and parse only if annotations are absent or insufficient.
3. **CLI with env vars** — tertiary. Check if a CLI is available (`which codacy-cli`, `which cs`, `which opengrep`) and if required env vars are set (`CODACY_API_TOKEN`, `CS_ACCESS_TOKEN`, etc.). Attempt to reproduce locally.
4. **Install and run** — last resort. If no CLI exists, install it (per the relevant skill) and run locally.

**Never skip step 1.** "I don't have access to SonarCloud" is wrong — the annotations are already on the PR via GitHub's check-runs API. The agent has `gh` access. Use it.

## The Loop — `/act` is iterative, not linear

`/act` is not a one-pass code review. It is an **end-to-end iterative loop** that runs until the PR is clean:

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ┌─── FETCH ───► ANALYSE ───► CONFIRM/REJECT ───┐     │
│   │                                                │     │
│   │   FIX ───► REPLY & RESOLVE ───► VERIFY CLEAN ─┘     │
│   │                                                   │     │
│   └─── PUSH ───► loop back to FETCH                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| Step | What | Details |
|------|------|---------|
| **FETCH** | Get current PR state | HEAD SHA, check-run status, open threads, SAST annotations |
| **ANALYSE** | Investigate each finding | Read annotations, read threads, understand what changed and why |
| **CONFIRM / REJECT** | Is this a real issue? | Not every finding is valid — reject false positives with documented reason |
| **FIX** | Change product code | One logical fix per commit, grouped sensibly |
| **REPLY & RESOLVE** | Per-thread response + resolve | Reply in thread pointing to commit, then resolve that thread |
| **VERIFY CLEAN** | Ensure no errors remain | `pr-state.sh` → `SAST_FINDINGS_PENDING=0`, `CI_REQUIRED_PENDING=0` |
| **PUSH** | Push to branch | Atomic push with clear commit messages |
| **LOOP** | Start again | Re-fetch state. New CI run may surface new findings. Repeat until clean. |

**There is no arbitrary iteration limit.** The loop runs until the PR is merge-ready or the context window is full. If context is running low, stop and **plan a handoff** (see below) instead of rushing to merge.

**Code review is one step in the loop, not the whole loop.** P0a/P0b (CI/SAST) and P1–P3 (review threads) are all part of the same iterative cycle. The agent does not "finish code review" and then "handle CI" — it does everything in each pass, because a fix may trigger new CI findings.

### Context management and handoff

When the context window is approaching capacity:

1. **Stop the loop.** Do not rush remaining fixes.
2. **Summarize current state** — what's fixed, what's pending, what CI shows on HEAD.
3. **Write a handoff file** if more work remains:
   - PR context: leave a comment on the PR summarizing progress and remaining items.
   - Batch context: write `.agents/review-debt/harvests/` or `.agents/backlog/` entries for remaining work.
4. **Report to user** with: "PR is at [state]. Remaining: [list]. Recommend running `/act` again to continue."

### Subagents for context preservation

Use subagents when the main `/act` context is getting large and you need to perform a sub-task without consuming the orchestrator's context window:

- **P5 (rating)**: Delegate to a `general` subagent — scoring is mechanical and does not need the full PR context.
- **Large SAST investigation**: If reproducing a Codacy/Sonar issue requires reading many files, delegate the investigation to an `investigator` subagent.
- **Batch debt processing**: For `/act harvest` or `/act backlog` with many threads, process groups in parallel subagents.

The orchestrator (`/act` itself) stays lean — it fetches state, plans, dispatches, and integrates results. Subagents do the deep work and return status.

## The main work — P0–P3

The main work is **P0–P3**: read each review thread, change **product code** (or post a substantive in-thread reply), commit, then close threads. P0 itself now has two halves — **P0a** (CI required-checks green on HEAD) and **P0b** (every `annotation_level=failure` on a failing SAST check is read and either fixed or triaged). Both are non-negotiable.  
Running the resolve script **without** doing that first is **wrong** — same as clicking "Resolve conversation" on every thread with no code changes.

## Contexts

`/act <context>` resolves threads from one of four sources and produces one PR:

| Context | Command | Source | Owner of the source |
| ------- | ------- | ------ | ------------------- |
| **`pr`** (default when a PR is in context) | `/act` (no arg) · `/act pr` · `/act 42` · `/act <url>` | Open threads on a single PR | Live PR |
| **`plan`** | `/act plan` | `.agents/plans/*.md` | `/plan` (future) |
| **`backlog`** | `/act backlog` | `.agents/backlog/*.md` | `/backlog` |
| **`harvest`** | `/act harvest` | `.agents/review-debt/harvests/*.jsonl` | `/harvest` |

Resolution rule: every `<context>` other than `pr` must `resolve by pr | branch` — i.e. each row in the source is keyed by a PR number (or branch name) and a thread id; `/act` then opens **one** batch PR that lists the source identifiers and fixes the threads in product code.

`/act` does **not** collect (`/harvest`) or triage (`/backlog`). The three skills form a one-way pipeline:

```text
PR merge → /harvest → /backlog → /act → /backlog (archive)
```

If a thread is on the live PR you're running `/act pr` against, fix it directly.
If it's in `harvests/*.jsonl`, run `/act harvest` (or its alias `/act debt`, see
below). If it's in `.agents/backlog/*.md`, run `/act backlog`.

### `/act debt` (alias for `harvest`)

`/act debt` is kept as a deprecated alias for `/act harvest` to avoid breaking
existing muscle memory. It is **not** a separate mode; the scripts under
`bun run act:debt:*` now resolve to the harvest-style batch PR (single batch PR
listing source PRs + thread ids).

## Wrong vs right

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

## PR metadata

**Never change pull request title or description** unless the user explicitly asks.

Do not replace the author's summary with checklists, thread counts, or CI notes. On GitHub Copilot, repository rules live in .github/copilot-instructions.md and .github/instructions/act.instructions.md.

## On start

1. React 👀 (or 👍).
2. **Resolve the PR context**. If the user supplied a number or URL, use it. If the user said `/act` with no PR, run `scripts/pr-from-context.sh` to fall back to the current branch's PR (or the most recently updated open PR). If ambiguous, ask the user before proceeding.
3. **HEAD SHA** — use `scripts/pr-state.sh` (with no arguments it resolves the PR from context) or `gh pr view NUMBER --json headRefOid,statusCheckRollup,url`.
4. **Inventory threads** — for each unresolved thread, capture: file/line, reviewer ask, whether it needs a **code change** or a **written answer**.

Build a short **thread plan** before editing (can be in your working notes / final summary):

```text
Thread 1 (path: …): [fix code | reply only] — what you will do
Thread 2 …
```

Do not start the resolve script until every open thread has a planned action and you have executed P0a / P0b / P1–P3.

## Debt context (`/act harvest`, `/act debt`, `/act backlog`)

Use after a `/harvest` cycle (or after `/backlog` triage has written
`.agents/backlog/*.md`) and you want to fix many threads in one batch PR.

| Step | What | Done when |
| ---- | ---- | --------- |
| **D0** | Load queue | `bun run act:debt:query -- --status open --limit N --format tsv` (harvest) **or** read `.agents/backlog/*.md` (backlog) |
| **D1** | Thread plan | Group by `area` / file; note `source_pr` + `thread_id` per row |
| **D2** | Branch | `cursor/<context>-YYYY-MM-DD-f7a9` |
| **D3** | Fix | Product code in `apps/`, `tools/`, `specs/`, … |
| **D4** | Verify | Same verify block as PR context where applicable |
| **D5** | PR | Title lists source PRs; body maps themes → commits |
| **D6** | Close loop | `bun run act:debt:done -- --status done --fix-pr N --threads-file …` |
| **D7** | Resolve | `resolve-open-threads.sh` on source PRs only after reply + fix |

Batch PR **merge-ready:** CI green on HEAD (`CI_REQUIRED_PENDING=0` AND `SAST_FINDINGS_PENDING=0`) + summary of themes fixed. Do **not**
require `open_threads=0` on source PRs before the batch PR merges.

Query helpers:

```bash
bun run act:debt:query -- --status open --limit N --format tsv
bun run act:debt:query -- --duplicates
bun run act:debt:query -- --area apps/openadt-cli
bun run act:debt:plan  -- --limit 25
bun run act:debt:done  -- --status done --fix-pr N --thread-id PRRT_…
```

After the batch PR merges, run `bun run harvest:archive` (or
`/backlog harvest`) so the harvest file is moved out of `harvests/`.

## Work order — PR context (mandatory sequence)

| Step | What | Done when |
|------|------|-----------|
| **P0a** | CI / merge blockers on **HEAD** | Required checks green on **current** HEAD (passing **and** failing-blockers resolved) |
| **P0b** | SAST error annotations on failing checks | For each FAILING SAST check, the agent has read every annotation_level=`failure` entry via `gh api repos/<owner>/<repo>/check-runs/<id>/annotations`, fixed in code or triaged with a documented reason (NOSONAR / suppression / false-positive link) |
| **P1** | Blocking review ("must fix", changes requested) | **Code fixed** on branch + **reply in that thread** |
| **P2** | Nits, questions, style | **Fix or answer in thread** (not silent) |
| **P3** | Inline suggestions | **Applied in code** or declined with reason **in thread** |
| **P4** | Resolve pass | Only after P0a / P0b / P1–P3 for **all** open threads |
| **P5** | Rate findings (research, opt-in) | Every check-run + review finding scored 0–5 in `tmp/agent_<pid>/scores-report.jsonl` (always); `review_scores.csv` only when explicitly opted in ([RATING_FLOW.md](references/RATING_FLOW.md)) |
| **P6** | Evaluation | Retrospect, update durable knowledge, cycle check — **before** merge-ready |

### P0a — CI green, no merge blockers

`pr-state.sh` reports `CI_REQUIRED_PENDING=N` for the **required** checks that
are blocking. Treat every non-AI-reviewer failing check as P0: green it
locally, push, or document why it cannot be fixed in this PR.

### P0b — Critical SAST error annotations (obligatory for failing checks)

When a required check fails from a **SAST tool**, the failing run is not the
whole story. The agent **must** read every annotation_level=`failure` entry it
produced (these are the inline `::error file=…line=…::…` annotations on the
PR), then for each one:

1. **Fix in product code** (preferred, same round-trip).
2. **Suppress with documented reason** (e.g. `// NOSONAR` for Sonar,
   `// nosemgrep` for Opengrep, `# noqa` for ShellCheck, inline `// @ts-ignore`
   with a comment for TypeScript) — never a whole-file suppression when a
   line-specific one works.
3. **Open an issue / backlog item** and link it in the in-thread reply if
   out-of-scope for this PR (e.g. a Sonar `security-rating` debt item).

#### SAST source priority (annotations first, always)

**Step 1: Read GitHub CI run annotations.** This is the primary source for all SAST findings.

```bash
# Get the check run ID for the failing SAST tool
gh pr checks <pr-number> --json name,status,conclusion

# Read annotations — this is the source of truth
gh api repos/<owner>/<repo>/check-runs/<check-run-id>/annotations
```

Most tools (SonarCloud, Codacy, CodeScene, CodeQL, Semgrep, Trivy) emit inline annotations via this API. **This is not an external service you cannot access** — these annotations are on your PR, via GitHub's own API, using `gh` which you already have.

**Step 2: Download SARIF if annotations are absent or insufficient.** Some tools (CodeQL, Snyk, Trivy) also produce SARIF artifacts. Check workflow artifacts:

```bash
gh api repos/<owner>/<repo>/actions/runs/<run-id>/artifacts
```

**Step 3: Check for CLI + env vars.** If annotations and SARIF don't give enough detail, check if a local CLI can reproduce:

| Tool | Check | Env var |
|------|-------|---------|
| Codacy | `which codacy-cli-v2` | `CODACY_API_TOKEN` |
| CodeScene | `which cs` | `CS_ACCESS_TOKEN` |
| SonarQube | `which sonar-scanner` | `SONAR_TOKEN` |
| Semgrep/Opengrep | `which opengrep` | (none — config in repo) |

**Step 4: Install and run locally** (last resort). See the relevant skill (codacy, codescene, etc.) for installation instructions.

`pr-state.sh` surfaces this as `SAST_FINDINGS_PENDING=N` — count of
`annotation_level=failure` entries on **failing** SAST runs (zero extra `gh`
calls when CI is fully green). Recognized SAST tools:

| Tool | Annotation carrier | Why it's P0 |
|------|-------------------|-------------|
| SonarCloud / SonarQube | `repos/<o>/<r>/check-runs/<id>/annotations` | New `BLOCKER` / `CRITICAL` finding on changed code |
| Codacy | same | Linter finding raised as `failure` annotation |
| CodeScene | same | Complexity / code-health finding on changed code |
| CodeQL | same | Security query match on changed code |
| Opengrep / Semgrep | same | Security rule match on changed code |
| Trivy / Snyk / Skillspector / GitGuardian | same | CVE / secret / committed-anomaly finding |

**Reading annotations is non-negotiable for failed SAST runs.** A failing
Codacy "N new issues (0 max.)" gate with `annotations=0` on the check-run
is the common case the cloud app rarely annotates in detail — in that scenario
the agent must read the underlying linter output, install the linter locally,
and reproduce the issue (see $codacy). A
failing SAST gate cannot be dismissed as "linter noise" or
"unclear" without the agent having read the annotations first.

The locally reproducible path (after annotations are read) is:

| Signal in `pr-state.sh` / `gh pr checks`                                | Reproduce locally                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------- |
| `Codacy Static Code Analysis` fail / action_required                    | **Step 1:** Read annotations via `gh api`. **Step 2:** If `annotations=0`, install linter per $codacy and run locally. |
| `Opengrep OSS` / `OpenGrep` fail                                        | **Step 1:** Read annotations. **Step 2:** `opengrep --config .semgrep.yaml <changed-paths>` |
| `SonarCloud Code Analysis` fail                                        | **Step 1:** Read annotations. **Step 2:** `sonar-scanner` (or read REVIEW.md for Sonar rules) |
| `CodeQL` fail                                                           | **Step 1:** Read annotations. **Step 2:** Download SARIF from workflow artifacts; re-run workflow job if needed |
| `CodeScene` fail                                                        | **Step 1:** Read annotations. **Step 2:** `cs delta origin/main HEAD` per $codescene |
| `Trivy` / `Snyk` fail                                                   | **Step 1:** Read annotations. **Step 2:** Download SARIF from artifacts; `trivy fs --format sarif .` or `snyk test` |

Codacy "N new issues (0 max.)" with `annotations=0` on the check-run
**always** means linter issues raised without inline annotations — install
the linter, run it, fix what it reports, push. Do not file the issue as
"unclear" without reproducing locally.

**Resolve is step P4, not step 1.**  
**P6 is mandatory before merge-ready** on every `/act` (cycle check + checklist); the **retrospective** portion is required only when something went wrong during the session (see [EVALUATE.md](references/EVALUATE.md)).  
If you cannot fix something in-repo, say so **in that thread**; do not resolve it without a visible reply.

## Per-thread loop (repeat for each open thread, within each pass of the main loop)

The per-thread loop runs **inside** each pass of the main loop. One pass of the main loop processes all open threads, then re-fetches state to see if CI has surfaced new findings.

1. **Read** the full thread (all comments).
2. **Act on substance:**
   - Bug / design / correctness → edit product files, run relevant checks.
   - Question → answer in the thread with specifics.
   - Suggestion → apply diff or explain why not.
3. **Commit** product changes (group sensibly; no empty commits).
4. **Reply in the thread** pointing to the commit or your decision (short, factual).
5. **Then** mark that thread resolved (see P4).

Skipping steps 2–4 and only running the batch resolve script **violates `/act`**.

After all threads are processed, **re-fetch state** (HEAD SHA, check-runs, annotations). New CI findings may have appeared from the last push. Start the main loop again.

## What to change

**In scope:** `apps/`, `tools/`, `specs/`, `packaging/`, `.github/workflows/`, etc.

**Out of scope for "addressing review":** `.agents/skills/`, `resolve-open-threads.sh` — unless the script literally cannot run (`bash -n` fails).

## Resolve pass (P4 only)

**Prerequisites (all must be true):**

- Every open thread has a **commit** and/or **in-thread reply** for its feedback.
- `gh auth status` succeeds.

```bash
bash -n scripts/resolve-open-threads.sh
bash scripts/resolve-open-threads.sh --dry-run OWNER REPO NUMBER
bash scripts/resolve-open-threads.sh OWNER REPO NUMBER
bash scripts/resolve-open-threads.sh --dry-run OWNER REPO NUMBER
```

The script only clicks "Resolve conversation" in GitHub — it does **not** implement review fixes.  
Resolve outdated threads too, but only after the underlying comment was handled on the branch.

## Rate findings (P5 — research dataset, **opt-in**)

After P4, score every tool finding (check-run annotations + inline review
comments) 0–5 so we can measure which review tools earn their slot. The agent
only judges; the scripts do the fetch/join/CSV work in two tool calls. Full
contract: [RATING_FLOW.md](references/RATING_FLOW.md).

**CSV recording is OFF by default.** By default `/act` should not pollute the
repo with a per-run commit just to grow a research dataset. Per-run data is
still captured (JSONL scratch under `tmp/agent_<pid>/` — gitignored,
automatically garbage-collected), so nothing is lost; only the persistent
`.agents/act/review_scores.csv` upsert is gated. Opt in via any of:

| Switch | Example | Lifetime |
|--------|---------|----------|
| CLI flag | `… --record` (or `--no-record` to override) | one run |
| Env var | `ACT_RECORD_SCORES=1 bun scripts/submit-scores.ts …` | one shell session |
| Config file | `.agents/act/config.json` `{"record_scores": true}` | until file removed |

Priority: `--record` > `ACT_RECORD_SCORES` > config file > default OFF. The
script prints `RECORDING=on\|off (source)` on every run so the choice is
auditable.

```bash
# prepare scratch dir once (repo ./tmp/ — never system /tmp)
mkdir -p tmp/agent_$$

# 1. one call — dump every finding with full metadata
bun scripts/extract-findings.ts OWNER REPO PR > tmp/agent_$$/findings.jsonl
# 2. read findings, write tmp/agent_$$/scores.tsv  (finding_id<TAB>0-5<TAB>why)
# 3. one call — join + upsert (writes scratch JSONL by default; CSV only if --record)
bun scripts/submit-scores.ts OWNER REPO PR --evaluator <model-id> \
  --findings tmp/agent_$$/findings.jsonl --scores tmp/agent_$$/scores.tsv \
  [--record]                # remove this flag once the research dataset
                            # is intentionally collected again
```

Scoring is **local-only** — it posts no reactions or comments (those are P1–P4).
Re-runs upsert on `(pr_url, finding_id, evaluator_id)`, so a second `/act` does
not duplicate rows in the persistent CSV.

## Evaluation (P6 — after P5, before merge-ready)

Follow [EVALUATE.md](references/EVALUATE.md). Durable sinks: REVIEW.md.

1. **Retain** — record what happened using the $memory-bank:
   - Mistake or debugging session → `.memory/experience/`
   - Observable project fact → `.memory/facts/`
2. **Retrospect** — run `/retrospect --plan` ($retrospect) to record experience and create actionable $backlog items.
3. **Cycle guard** — if any signal fires, **do not merge**; escalate to the user with evidence:

   - A review thread was **reopened** after an earlier resolve on this PR.
   - The **same rule/alert** (Codacy, Semgrep, Code Scanning) was flagged **2+ times** after a fix commit — verify fix on current HEAD before another merge attempt.
   - **2+ `/act` runs** on the same PR with **no new product commits** since the last run — report an `/act` cycle; do not resolve-only again.

4. **Fix counts** — name source system and query on **current HEAD** (REVIEW.md).

## Merge-ready — the loop has converged

Say **merge-ready** only when the loop has run enough passes that all of these are true:

1. Review feedback is **done in code** (or explicitly declined in threads with reason).
2. CI required checks **success on current HEAD** (`CI_REQUIRED_PENDING=0`).
3. **SAST findings clean** — `SAST_FINDINGS_PENDING=0` from final pr-state.sh; every `annotation_level=failure` entry on a failing SAST check has been fixed, suppressed with documented reason, or triaged to backlog (P0b).
4. `open_threads=0` from final `--dry-run`.
5. Summary lists **what you changed per theme/file**, not only "resolved N threads".
6. **P5 done** — per-run scratch report (`tmp/agent_<pid>/scores-report.jsonl`) written; persistent `review_scores.csv` only updated when the run was **opted in** (`--record` / `ACT_RECORD_SCORES=1` / config). When recording IS enabled this row must be committed on the PR branch. Delegate to a `general` subagent (not the orchestrator) to keep the main context cheap. Pass the `--evaluator` value as the subagent's model name (e.g. `claude-haiku-4-5`). Do NOT re-extract findings after scoring begins — use one `findings.jsonl` per `/act` run.
7. **P6 passed** — no cycle signals (reopened threads, duplicate rule flags, empty `/act` loop); retrospective + sink update done if anything went wrong this session.

**If the loop is still producing new findings on each push, it has not converged.** Keep iterating. If context is running low, hand off instead of rushing.

## PR closing summary

1. Status  
2. **HEAD** SHA  
3. **Review fixes** (bullet per theme / file — this is the main section)  
4. Threads: how many resolved **after** fixes; `open_threads=0`  
5. CI on HEAD (`CI_REQUIRED_PENDING=0`)  
6. **SAST (P0b):** `SAST_FINDINGS_PENDING=0`; for each prior `failure` annotation, what changed (fixed / suppressed / backlog link)  
7. **P5:** findings rated (N rows in scratch; M rows committed to `review_scores.csv` iff recording was opted in this run)  
8. **P6:** cycle signals (none / blocked — list)  
9. Left  

## Idempotency

If feedback is already fixed on HEAD and threads are closed → short "already done", no resolve-only rerun.

## Validation

`bunx nx format:write` on touched `tools/**/*.ts` before commit.

## Token-rationalized workflow

Use the helpers under [`scripts/`](scripts/) instead of issuing ad-hoc `gh` calls.
They collapse the typical 30+ tool calls per `/act` into ~10. From repo root,
prefix paths with `.agents/skills/act/` (or use `bun run act:debt:*` for ledger ops).

| Step                         | Use                                                       | Replaces                                    |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| **PR state + open threads**  | `bash scripts/pr-state.sh OWNER REPO PR`                  | `gh pr view --json ...` ×4 + `gh pr checks` |
| **Verify a CLI claim**       | `bun scripts/derive-cli-surface.ts --check "openadt X"`   | `grep` across `apps/**.java` + reads        |
| **Post N thread replies**    | `bash scripts/reply-threads.sh --file tmp/agent/replies.tsv` | N × `gh api graphql addPullRequestReview…` |
| **Resolve open threads (P4)**| `bash scripts/resolve-open-threads.sh OWNER REPO PR`      | unchanged                                   |
| **Extract findings (P5)**    | `bun scripts/extract-findings.ts OWNER REPO PR`           | N × `gh api` check-runs/annotations/comments reads |
| **Submit scores (P5)**       | `bun scripts/submit-scores.ts … --findings F --scores S [--record]` | per-finding parse + JSONL scratch always; CSV upsert only with `--record` (or env/config) |
| **Query debt (D0)**          | `bun run act:debt:query -- --status open --format tsv`    | Reading harvest files by hand |
| **Plan debt batch (D1)**     | `bun run act:debt:plan -- --limit 25`                     | Hand-grouping ledger rows |
| **Mark debt done (D6)**      | `bun run act:debt:done -- --status done …`                | Editing `ledger.jsonl` by hand |
| **Archive harvests (post-D7)**| `bun run harvest:archive`                                 | Hand-moving files into `archive/` |

**Scratch artifacts (e.g. `replies.tsv`, `findings.jsonl`) MUST live under repo `./tmp/`** —
e.g. `tmp/agent/<run>/`. **Not** system `/tmp` (cloud agents may write outside the clone). **Not** `scripts/` or repo root. `tmp/` is gitignored. `reply-threads.sh --file` accepts repo-relative or absolute paths under the clone.

**`replies.tsv` format** (one row per thread). TAB separates the thread ID
from the body; newlines and tabs in the body must be escaped as `\n` and `\t`
(the script decodes them before POST):

```tsv
<thread_id>    <reply body on a single line; \n for newlines, \t for tabs>
```

**Gotcha:** `gh api graphql` accepts `-f query=...` + `-F var=val` together, but
**not** `--input FILE` (which discards `-F`). Use `-f` for the query and `-F`
or `-f` for variables.

If `MERGEABLE=UNKNOWN` in `pr-state.sh` output, the GraphQL `mergeable` field
is cached (computed asynchronously by GitHub's merge-queue worker; see
gh-cli #9583). Note that `mergeable` (merge conflict status:
`MERGEABLE`/`CONFLICTING`) and `mergeStateStatus` (overall merge button
state: `CLEAN`/`BLOCKED`/`DIRTY`/etc.) are **separate** GraphQL fields and
must not be conflated. The script reads `mergeStateStatus` from the same
GraphQL query as the other PR fields, so a stale `mergeable` value does not
block `/act` decisions.

## Runtime extras

- **Copilot SWE:** .github/copilot-instructions.md
- **Codex / Claude:** AGENTS.md § Cloud agents on GitHub
