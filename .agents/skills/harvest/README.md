# harvest skill

Portable [Agent Skill](https://agentskills.io/specification) for `/harvest` —
collects unresolved PR review threads into an append-only ledger on `main`.

## Layout

| Path | Purpose |
| ---- | ------- |
| `SKILL.md` | Agent instructions (load on `/harvest`) |
| `scripts/` | gh/bun helpers (`harvest-threads.ts`, `harvest-debt-batch.ts`, `resolve-harvest-*`, `land-harvest-files.sh`, `archive-harvest.ts`, `harvest-cli.ts`, `review-debt-{lib,gh,text}.ts`) |
| `references/` | (reserved) |
| `project.json` | Nx targets (`harvest-skill:harvest-*`) |

## Move to another repo

Copy this directory and `.agents/review-debt/`. Requirements:

- `gh`, `jq`, `bun`
- Wire `package.json` scripts or call `bun scripts/harvest-cli.ts` from the
  skill root
- Set `OPENADT_DEBT_DIR` / `OPENADT_DEBT_FILE` if the ledger path differs

OpenADT wires convenience targets at repo root: `bun run harvest:*`.

## Boundaries

`/harvest` is a **one-way collect** — it never reads `ledger.jsonl`, never
edits `.agents/backlog/*`, never opens a fix PR, never resolves threads. Those
belong to `/backlog` and `/act` respectively. See
[`SKILL.md`](SKILL.md) for the full contract.
