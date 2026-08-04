# /act P6 evaluation checklist

Run **after P4 resolve**, before claiming merge-ready. Takes ~2 minutes.

## 1. Session retrospective (required if anything went wrong)

Answer in your closing summary or write to `.memory/experience/` per the [persistent-memory](../../../foundation/persistent-memory/SKILL.md) skill. Then run `/retrospect --plan` ([retrospect](../../../self-learning/retrospect/SKILL.md)) to produce [backlog](../../../workflow/planning/backlog/SKILL.md) items:

- [ ] Did we confuse review tools (Codacy vs GitHub Code Scanning vs Dependabot vs Copilot review)?
- [ ] Did we resolve threads without code fixes or in-thread replies?
- [ ] Did we claim fix counts without querying the correct API?
- [ ] Did we use whole-file semgrep exclusions instead of line-specific suppressions?
- [ ] Did we edit PR title/body without explicit user request?

If **any** box is “yes”: write **what / root cause / prevention** and update the sink in [REVIEW.md](../../../REVIEW.md).

## 2. Cycle detection (required every /act)

- [ ] **Reopened thread:** any thread was resolved earlier in this PR then commented on again → **stop**, list threads, do **not** merge; user must confirm next step.
- [ ] **Same rule 2+ times:** same Codacy/Semgrep/rule ID flagged again after a fix commit → verify fix is on **current HEAD** and suppression/answer is in the right sink; do **not** re-merge blindly.
- [ ] **Empty /act loop:** this is the 2+ `/act` invocation on the same PR with **no new product commits** since last run → **stop** and report cycle; diagnose in retrospective.

## 2b. Critical SAST error annotations (required every /act)

`pr-state.ts` surfaces `SAST_FINDINGS_PENDING=N` (count of
`annotation_level=failure` entries on FAILING SAST checks). Before merge-ready:

- [ ] **Annotation-level=failure entries were read** for every failing SAST
      check, not just the check status: `gh api repos/<o>/<r>/check-runs/<id>/annotations`.
- [ ] **Each `failure` annotation has one of:** (a) a product-code fix on HEAD,
      (b) a line-specific suppression with a documented reason
      (`NOSONAR` / `nosemgrep` / `# noqa` / `# @ts-expect-error` with an
      explanatory comment), or (c) an out-of-scope decision recorded in the
      in-thread reply + linked backlog/issue.
- [ ] **No whole-file suppressions** were added when a line-specific one
      works — per rule per file in the strictest tools (Codacy, SonarCloud).
- [ ] **`SAST_FINDINGS_PENDING` is 0** at the point you claim merge-ready.
      If it cannot be 0 (e.g. transient infrastructure), document why in
      the PR closing summary rather than silently glossing over it.

## 2a. Efficiency regression (required every /act)

- [ ] **Scriptable cost:** did any step burn more than a few tool calls doing mechanical work (repeated `gh`/`grep`/`read` loops, hand-formatting, re-echoing data) that a `scripts/` helper in this skill could collapse into one call? → file a [backlog](../../../workflow/planning/backlog/SKILL.md) item (`source:` = this PR). Not required to fix in this `/act`; this is the self-learning loop behind [AGENTS.md → Script over steps](../../../AGENTS.md).

## 3. Durable knowledge (optional unless retrospective triggered)

- [ ] Workflow/process lesson → [SKILL.md](../SKILL.md) (and `.memory/experience/` if recurring)
- [ ] API/tool confusion → [REVIEW.md](../../../REVIEW.md)
- [ ] Codacy/domain false positive → [review.md](../../../.codacy/instructions/review.md)

## 4. Agent memory reminder (optional)

If the lesson is user-specific (e.g. “always use Codacy MCP on this org”), suggest the user paste the snippet from [codacy § Memory reminder template](../../../integrations/codacy/SKILL.md#memory-reminder-template) into their Cursor user rules — do not commit private landscape data.

## 5. P6 has two surfaces — keep them separate

P6 produces two artifacts, and they go to two different places:

- **External-facing status** (PR comment on the PR): a short
  summary that the maintainer / external reviewer needs to see —
  HEAD SHA, CI status, `open_threads`, what's NOT in scope, and a
  note that the full detail is internal (the agent's memory), not
  a link to the local worktree, which reviewers cannot access.
  This is what a human reviewer reads in their inbox. Keep it
  under 15 lines; do not include iteration-by-iteration change
  logs, the retrospective reasoning, or P5 scores. Example shape:

  > PR #N is merge-ready. All CI green on `<sha>`. N/N review
  > threads resolved. No outstanding cycle-guard signals.
  > Iteration log, P5 ratings, and the P6 retrospective are kept
  > internally in the agent's memory (not reviewer-accessible).

- **Internal retrospective** (memory + REVIEW.md): the full
  iteration log, what went wrong, root causes, prevention, and
  process lessons. This is for the agent's own learning loop
  and for future `/act` runs on other PRs. Write to
  `.memory/experience/<date>-<topic>.md` via the
  [persistent-memory](../../../foundation/persistent-memory/SKILL.md)
  skill; durable API/tool/domain lessons go to `REVIEW.md`. Do
  NOT post this as a PR comment — external reviewers don't need
  the agent's self-critique, and the retrospective's job is to
  improve future runs, which means living where the agent reads
  memory, not where reviewers scroll GitHub.

If a retrospective is required (something went wrong this
session), the closing PR comment should mention that the
retrospective is in memory, not inline it. If nothing went
wrong, the PR comment can be concise — but it must still carry
all the required merge-decision inputs (HEAD SHA, CI status,
thread count, what's NOT in scope, and the internal-detail
pointer); "one-liner" means no retrospective prose, not dropping
those fields.

### Concrete split: what goes on the PR comment, what goes to memory

The two-surface rule is meaningless without a concrete list. The
default assignment is:

| Item | Surface |
|------|---------|
| HEAD SHA | PR comment (one line) |
| CI status (green / failing / N/A) | PR comment (one line) |
| `open_threads` count + total | PR comment (one line) |
| "What's NOT in scope" (deferred items, blocking reasons) | PR comment (one line) |
| Internal-detail pointer (memory entry; not the worktree) | PR comment (one line) |
| Per-file change list | PR comment (3-5 lines max — file:theme, not a full diff) |
| Iteration-by-iteration change log | Memory (not the PR) |
| P5 ratings (per-tool scores, dataset rows) | Memory + `review_scores.csv` (if recorded) |
| Retrospective reasoning (what went wrong, why, prevention) | Memory + REVIEW.md |
| Cycle-guard diagnostic (re-opens, false negatives, etc.) | Memory |
| Process lessons for future `/act` runs | Memory (`.memory/experience/<date>-<topic>.md`) |
| API/tool gotchas (e.g. GraphQL "comment: null" false negative) | Memory + REVIEW.md |
| Code-review findings (per-thread fix) | **In the THREAD** (per-thread reply + resolve), NOT a top-level comment |

The last row is the most-violated rule. A code-review finding's
natural home is the thread that contains it, not a top-level PR
comment that summarizes the whole iteration. Even when the bot
auto-resolves, post the per-thread reply anyway — it's the audit
trail, and external reviewers will click into the thread, not
scroll the top-level summary.

The PR comment is for the merge-decision inputs (HEAD, CI,
threads, in-scope, pointer). Everything else lives in memory.
