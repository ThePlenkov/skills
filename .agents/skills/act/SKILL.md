---
name: act
description: >-
  Use when the user invokes /act on a PR/MR or /act <context> with
  context ∈ {pr, plan, backlog, harvest}. Resolves threads in product code
  (or posts a substantive in-thread reply), commits, then closes threads.
  Never resolve-only. Harvest (collecting threads) lives in /harvest;
  triage (priority / grouping / wontfix) lives in /backlog. /act is the
  fix loop, not the collect or triage.
disable-model-invocation: true
compatibility: Requires gh, jq, bun.
---

# /act

Portable skill layout ([agentskills.io](https://agentskills.io/specification)): `scripts/` (helpers), `references/` (EVALUATE, RATING_FLOW). Copy `.agents/skills/act/` to relocate.

**`/act` means fix the PR, not hide review comments.**

The main work is **P0–P3**: read each review thread, change **product code** (or post a substantive in-thread reply), commit, then close threads. P0 itself now has two halves — **P0a** (CI required-checks green on HEAD) and **P0b** (every `annotation_level=failure` on a failing SAST check is read and either fixed or triaged). Both are non-negotiable.  
Running the resolve script **without** doing that first is **wrong** — same as clicking "Resolve conversation" on every thread with no code changes.

Applies to `/act`, `/act pr`, `/act plan`, `/act backlog`, `/act harvest`, `@claude /act`, `@codex /act`, `@copilot /act`.

**No Playwright** for GitHub PR UI.

## Contexts

`/act <context>` resolves threads from one of four sources and produces one PR:

| Context | Command | Source | Owner of the source |
| ------- | ------- | ------ | ------------------- |
| **`pr`** (default when a PR is in context) | `/act` · `/act pr` · `/act 42` | Open threads on a single PR | Live PR |
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

## PR metadata

**Never change pull request title or description** unless the user explicitly asks.

Do not replace the author's summary with checklists, thread counts, or CI notes. On GitHub Copilot, repository rules live in [`.github/copilot-instructions.md`](../../../.github/copilot-instructions.md) and [`.github/instructions/act.instructions.md`](../../../.github/instructions/act.instructions.md).

## On start

1. React 👀 (or 👍).
2. **HEAD SHA** — `gh pr view NUMBER --json headRefOid,statusCheckRollup,url`.
3. **Resolve the context** (see table above) and **inventory threads** — for each unresolved thread, capture: file/line, reviewer ask, whether it needs a **code change** or a **written answer**.

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

`pr-state.sh` surfaces this as `SAST_FINDINGS_PENDING=N` — count of
`annotation_level=failure` entries on **failing** SAST runs (zero extra `gh`
calls when CI is fully green). Recognized SAST tools:

| Tool | Annotation carrier | Why it’s P0 |
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
and reproduce the issue (see [Codacy skill](../codacy/SKILL.md)). A
failing SAST gate cannot be dismissed as "linter noise" or
"unclear" without the agent having read the annotations first.

The locally reproducible path (after annotations are read) is:

| Signal in `pr-state.sh` / `gh pr checks`                                | Reproduce locally                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------- |
| `Codacy Static Code Analysis` fail / action_required                    | **Token-rational:** Read GitHub API annotations first (`gh api repos/<owner>/<repo>/check-runs/<id>/annotations`), then run local linter. See [Codacy skill](../codacy/SKILL.md#token-rational-codacy-workflow-priority). |
| `Opengrep OSS` / `OpenGrep` fail                                        | `opengrep --config .semgrep.yaml <changed-paths>`   |
| `SonarCloud Code Analysis` fail                                        | `sonar-scanner` (or read [REVIEW.md](../../../REVIEW.md) for Sonar rules) |
| `CodeQL` fail                                                           | Re-run workflow job; SARIF details in artifacts     |

Codacy "N new issues (0 max.)" with `annotations=0` on the check-run
**always** means linter issues raised without inline annotations — install
the linter, run it, fix what it reports, push. Do not file the issue as
"unclear" without reproducing locally.

**Resolve is step P4, not step 1.**  
**P6 is mandatory before merge-ready** on every `/act` (cycle check + checklist); the **retrospective** portion is required only when something went wrong during the session (see [EVALUATE.md](references/EVALUATE.md)).  
If you cannot fix something in-repo, say so **in that thread**; do not resolve it without a visible reply.

## Per-thread loop (repeat for each open thread)

1. **Read** the full thread (all comments).
2. **Act on substance:**
   - Bug / design / correctness → edit product files, run relevant checks.
   - Question → answer in the thread with specifics.
   - Suggestion → apply diff or explain why not.
3. **Commit** product changes (group sensibly; no empty commits).
4. **Reply in the thread** pointing to the commit or your decision (short, factual).
5. **Then** mark that thread resolved (see P4).

Skipping steps 2–4 and only running the batch resolve script **violates `/act`**.

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

Follow [EVALUATE.md](references/EVALUATE.md). Durable sinks: [REVIEW.md](../../../REVIEW.md).

1. **Retain** — record what happened using the [memory-bank skill](../memory-bank/SKILL.md):
   - Mistake or debugging session → `.agents/memory/experience/`
   - Observable project fact → `.agents/memory/facts/`
2. **Retrospect** — run `/retrospect --plan` ([retrospect skill](../retrospect/SKILL.md)) to record experience and create actionable [backlog](../backlog/SKILL.md) items.
3. **Cycle guard** — if any signal fires, **do not merge**; escalate to the user with evidence:

   - A review thread was **reopened** after an earlier resolve on this PR.
   - The **same rule/alert** (Codacy, Semgrep, Code Scanning) was flagged **2+ times** after a fix commit — verify fix on current HEAD before another merge attempt.
   - **2+ `/act` runs** on the same PR with **no new product commits** since the last run — report an `/act` cycle; do not resolve-only again.

4. **Fix counts** — name source system and query on **current HEAD** ([REVIEW.md](../../../REVIEW.md)).

## Merge-ready

Say **merge-ready** only when:

1. Review feedback is **done in code** (or explicitly declined in threads with reason).
2. CI required checks **success on current HEAD** (`CI_REQUIRED_PENDING=0`).
3. **SAST findings clean** — `SAST_FINDINGS_PENDING=0` from final pr-state.sh; every `annotation_level=failure` entry on a failing SAST check has been fixed, suppressed with documented reason, or triaged to backlog (P0b).
4. `open_threads=0` from final `--dry-run`.
5. Summary lists **what you changed per theme/file**, not only "resolved N threads".
6. **P5 done** — per-run scratch report (`tmp/agent_<pid>/scores-report.jsonl`) written; persistent `review_scores.csv` only updated when the run was **opted in** (`--record` / `ACT_RECORD_SCORES=1` / config). When recording IS enabled this row must be committed on the PR branch. Delegate to a `general` subagent (not the orchestrator) to keep the main context cheap. Pass the `--evaluator` value as the subagent's model name (e.g. `claude-haiku-4-5`). Do NOT re-extract findings after scoring begins — use one `findings.jsonl` per `/act` run.
7. **P6 passed** — no cycle signals (reopened threads, duplicate rule flags, empty `/act` loop); retrospective + sink update done if anything went wrong this session.

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
must not be conflated. The script already reads `mergeStateStatus` from
`gh pr view --json` (which itself uses GraphQL) on every run, so a stale
`mergeable` value does not block `/act` decisions.

## Runtime extras

- **Copilot SWE:** [`.github/copilot-instructions.md`](../../../.github/copilot-instructions.md)
- **Codex / Claude:** [AGENTS.md](../../../AGENTS.md) § Cloud agents on GitHub
