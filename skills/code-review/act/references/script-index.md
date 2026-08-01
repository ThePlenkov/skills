# Script index

Use the helpers under [`scripts/`](../scripts/) instead of issuing ad-hoc `gh`/`glab` calls. They collapse the typical 30+ tool calls per `/act` into ~10. From repo root, prefix paths with `.agents/skills/act/` (or use `bun run act:debt:*` for ledger ops).

The `review-*` scripts auto-detect GitHub vs GitLab from the `origin` remote; override with `ACT_PROVIDER=github|gitlab` or `GITLAB_HOST`.

| Step | Use |
| ---------------------------- | --------------------------------------------------------- |
| **Review state + open threads** | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/review-state.sh [PROJECT] [NUMBER]` |
| **Move review to draft/ready** | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/set-review-state.sh --draft or --ready [PROJECT] [NUMBER]` |
| **Post N thread replies**    | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/review-reply.sh --file tmp/agent/replies.tsv [--reaction EYES or THUMBS_UP]` |
| **Resolve open threads (P4)**| `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/review-resolve.sh --file tmp/open_ids.txt` |
| **GitHub-only state**        | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/pr-state.sh OWNER REPO PR` (legacy, richer CI/SAST detail) |
| **GitHub-only replies**      | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/reply-threads.sh --file tmp/agent/replies.tsv` |
| **GitHub-only resolve**      | `npx --yes tsx@4 scripts/run.ts .agents/skills/act/scripts/resolve-open-threads.sh OWNER REPO PR` |
| **Verify a CLI claim**       | `bun scripts/derive-cli-surface.ts --check "openadt X"`   |
| **Extract findings (P5)**    | `bun scripts/extract-findings.ts OWNER REPO PR`           |
| **Submit scores (P5)**       | `bun scripts/submit-scores.ts … --findings F --scores S [--record]` (CSV upsert only with `--record` / env / config) |
| **Query debt (D0)**          | `bun run act:debt:query -- --status open --format tsv`    |
| **Plan debt batch (D1)**     | `bun run act:debt:plan -- --limit 25`                     |
| **Mark debt done (D6)**      | `bun run act:debt:done -- --status done …`                |
| **Archive harvests (post-D7)**| `bun run harvest:archive`                                |

Scratch artifact rules (`tmp/`, `replies.tsv` format, GraphQL `-f` / `-F` gotcha, `MERGEABLE=UNKNOWN` cache note) live in [`references/script-gotchas.md`](script-gotchas.md).
