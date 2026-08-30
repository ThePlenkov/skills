# Script index

Use the helpers under [`scripts/`](../scripts/) instead of issuing ad-hoc `gh`/`glab` calls. They collapse the typical 30+ tool calls per `/act` into ~10. From repo root, prefix paths with `.agents/skills/act/` (or use `bun run act:debt:*` for ledger ops).

The `review-*` scripts auto-detect GitHub vs GitLab from the `origin` remote; override with `ACT_PROVIDER=github|gitlab` or `GITLAB_HOST`. GitLab helpers use the **REST v4 API** (stable) for MR metadata, discussions, draft/ready, replies, and resolve — not GraphQL, whose `DiffNote`/`mergeRequestSetDraft`/discussion-ID shape churned (issue #284).

| Step | Use |
| ---------------------------- | --------------------------------------------------------- |
| **Review state + open threads** | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/review-state.ts [PROJECT] [NUMBER]` |
| **Move review to draft**     | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/set-review-state.ts --draft [PROJECT] [NUMBER]` |
| **Move review to ready**     | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/set-review-state.ts --ready [PROJECT] [NUMBER]` |
| **Post N thread replies**    | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/review-reply.ts --file tmp/agent/replies.tsv [--reaction <reaction>]` |
| **Resolve open threads (P4)**| `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/review-resolve.ts --file tmp/open_ids.txt` |
| **GitHub-only state**        | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/pr-state.ts OWNER REPO PR` (GitHub-only, richer CI/SAST detail) |
| **Thread replies**           | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/review-reply.ts --file tmp/agent/replies.tsv [--reaction <reaction>]` |
| **GitHub-only resolve all**  | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/resolve-open-threads.ts [--dry-run] [OWNER REPO PR]` |
| **Verify a CLI claim**       | `bun scripts/derive-cli-surface.ts --check "openadt X"`   |
| **Extract findings (P5)**    | `bun scripts/extract-findings.ts OWNER REPO PR` (GitHub) · `bun scripts/extract-findings.ts GROUP PROJECT MR_IID` (GitLab; subgroups: `GROUP/SUBGROUP PROJECT MR_IID`)           |
| **Submit scores (P5)**       | `bun scripts/submit-scores.ts OWNER REPO PR --evaluator ID --findings F --scores S [--record]` — `OWNER REPO` is GitHub `owner/repo` or GitLab `group/project`; the source review URL is built per provider. CSV upsert only with `--record` / env / config. |
| **Query debt (D0)**          | `bun run act:debt:query -- --status open --format tsv`    |
| **Plan debt batch (D1)**     | `bun run act:debt:plan -- --limit 25`                     |
| **Mark debt done (D6)**      | `bun run act:debt:done -- --status done …`                |
| **Archive harvests (post-D7)**| `bun run harvest:archive`                                |

For `review-reply.ts`, use `EYES` or `THUMBS_UP` as the reaction value.

Scratch artifact rules (`tmp/`, `replies.tsv` format, GraphQL `-f` / `-F` gotcha, `MERGEABLE=UNKNOWN` cache note) live in [`script-gotchas.md`](script-gotchas.md).
