# act skill

Portable [Agent Skill](https://agentskills.io/specification) for `/act` — fix
review feedback on a single PR (`/act pr`) or batch-fix from a context
(`/act plan`, `/act backlog`, `/act harvest`). Harvest (collecting threads)
lives in $harvest; triage (priority, grouping,
wontfix) lives in $backlog.

## Layout

| Path | Purpose |
| ---- | ------- |
| `SKILL.md` | Agent instructions (load on `/act`) |
| `scripts/` | gh/bun helpers (`pr-state.ts`, `review-state.ts`, `review-reply.ts`, `review-resolve.ts`, `query-debt`, `plan-debt-batch`, `update-debt-status`, P5 extract/submit, …) |
| `references/` | `EVALUATE.md` (P6), `RATING_FLOW.md` (P5) |

The shared ledger types/helpers (`scripts/review-debt-{lib,gh,text}.ts`) live in
[`.agents/skills/harvest/scripts/`](../harvest/scripts/) — the act skill imports
them through a relative path. This is the **only** cross-skill dependency /act
has: it never imports from `/backlog`.

## Tracking policy

By default `/act` **does not** modify any persistent dataset. Two outputs are
explicitly opt-in; everything else is offline-only:

| Output | Path | Default | Opt-in |
| ------ | ---- | ------- | ------ |
| Per-run scratch JSONL (one row per rated finding) | `tmp/agent_<pid>/scores-report.jsonl` | always written (gitignored) | — |
| Persistent research dataset | `.agents/act/review_scores.csv` | OFF | `--record` CLI, `ACT_RECORD_SCORES=1` env, or `.agents/act/config.json` `{"record_scores": true}` |

The persistent CSV is intentionally opt-in so that running `/act` does not
cost a commit per PR or pollute repo history unless the operator is actively
analysing the dataset. See [RATING_FLOW.md](references/RATING_FLOW.md) for the
exact switch priority.

## Pipeline gating (P0 = CI + critical SAST)

[pr-state.ts](scripts/pr-state.ts) (`npx tsx scripts/run.ts skills/code-review/act/scripts/pr-state.ts`) surfaces two P0-relevant signals:

- `CI_REQUIRED_PENDING=N` — required non-AI-reviewer checks that are not
  passing.
- `SAST_FINDINGS_PENDING=N` — count of `annotation_level=failure` entries on
  failing SAST check-runs (SonarCloud, Codacy, CodeScene, CodeQL, Opengrep /
  Semgrep, Trivy, Snyk, Skillspector, GitGuardian).

Both must be 0 for merge-ready. Reading annotations is **non-negotiable** for
failed SAST runs — see [SKILL.md § P0b](SKILL.md) and
[EVALUATE.md § 2b](references/EVALUATE.md).

## Move to another repo

Copy this directory (and `.agents/skills/harvest/` plus `.agents/review-debt/`).
Requirements:

- `gh`, `bun` (GitLab workflows need `GITLAB_TOKEN` or `GLAB_TOKEN`)
- Wire `package.json` scripts or call `bun scripts/review-debt-cli.ts` from the skill root
- Set `OPENADT_DEBT_FILE` / `OPENADT_DEBT_SUMMARY` if the ledger path differs

OpenADT wires convenience targets at repo root: `bun run act:debt:*`,
`bun run harvest:*`.
