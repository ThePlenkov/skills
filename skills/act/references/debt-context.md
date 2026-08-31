# Debt context — `/act harvest`, `/act debt`, `/act backlog`

Use after a `/harvest` cycle (or after `/backlog` triage has written
`.agents/backlog/*.md`) and you want to fix many threads in one batch
PR.

## Steps

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

## Merge-ready for batch PR

CI green on HEAD (`CI_REQUIRED_PENDING=0` AND `SAST_FINDINGS_PENDING=0`
AND `SAST_FINDINGS_UNKNOWN=0`)
+ summary of themes fixed. Do **not** require `open_threads=0` on
source PRs before the batch PR merges.

After the batch PR merges, run `bun run harvest:archive` (or
`/backlog harvest`) so the harvest file is moved out of `harvests/`.

## `/act debt` (alias for `harvest`)

`/act debt` is a deprecated alias for `/act harvest`. It is **not** a
separate mode; the scripts under `bun run act:debt:*` resolve to the
harvest-style batch PR.

## Context resolution

Every `<context>` other than `pr` must `resolve by pr | branch` — each
row in the source is keyed by a PR number (or branch name) and a thread
id; `/act` then opens **one** batch PR that lists the source identifiers
and fixes the threads in product code.

If a thread is on the live PR you're running `/act pr` against, fix it
directly. If it's in `harvests/*.jsonl`, run `/act harvest` (or its
alias `/act debt`). If it's in `.agents/backlog/*.md`, run `/act backlog`.
