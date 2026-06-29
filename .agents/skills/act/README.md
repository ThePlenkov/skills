# act skill

Portable [Agent Skill](https://agentskills.io/specification) for `/act` — fix
review feedback on a single PR (`/act pr`) or batch-fix from a context
(`/act plan`, `/act backlog`, `/act harvest`). Harvest (collecting threads)
lives in [`.agents/skills/harvest/`](../harvest/); triage (priority, grouping,
wontfix) lives in [`.agents/skills/backlog/`](../backlog/).

## Layout

| Path | Purpose |
| ---- | ------- |
| `SKILL.md` | Agent instructions (load on `/act`) |
| `scripts/` | gh/bun helpers (`pr-state.sh`, `query-debt`, `plan-debt-batch`, `update-debt-status`, P5 extract/submit, …) |
| `references/` | `EVALUATE.md` (P6), `RATING_FLOW.md` (P5) |
| `project.json` | Nx targets (`act-skill:act-debt-*`) |

The shared ledger types/helpers (`scripts/review-debt-{lib,gh,text}.ts`) live in
[`.agents/skills/harvest/scripts/`](../harvest/scripts/) — the act skill imports
them through a relative path. This is the **only** cross-skill dependency /act
has: it never imports from `/backlog`.

## Move to another repo

Copy this directory (and `.agents/skills/harvest/` plus `.agents/review-debt/`).
Requirements:

- `gh`, `jq`, `bun`
- Wire `package.json` scripts or call `bun scripts/review-debt-cli.ts` from the skill root
- Set `OPENADT_DEBT_FILE` / `OPENADT_DEBT_SUMMARY` if the ledger path differs

OpenADT wires convenience targets at repo root: `bun run act:debt:*`,
`bun run harvest:*`.
