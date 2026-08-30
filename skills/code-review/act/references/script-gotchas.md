# `/act` Script Gotchas

Long-tail rules for the helper scripts in `scripts/`. The SKILL body
points here when a "gotcha" can waste a tool call.

## Scratch artifact rules

**Scratch artifacts (e.g. `replies.tsv`, `findings.jsonl`) MUST live
under repo `./tmp/`** — e.g. `tmp/agent/<run>/`. **Not** system `/tmp`
(cloud agents may write outside the clone). **Not** `scripts/` or repo
root. `tmp/` is gitignored. `review-reply.ts --file` accepts
repo-relative or absolute paths under the clone.

## `replies.tsv` format

One row per thread. TAB separates the thread ID from the body;
newlines and tabs in the body must be escaped as `\n` and `\t` (the
script decodes them before POST):

```tsv
<thread_id>    <reply body on a single line; \n for newlines, \t for tabs>
```

## GraphQL `gh api` gotcha

`gh api graphql` accepts `-f query=...` + `-F var=val` together, but
**not** `--input FILE` (which discards `-F`). Use `-f` for the query
and `-F` or `-f` for variables.

## `reviewThreads(first:)` vs `reviewThreads(last:)` — pagination direction

GitHub's `reviewThreads` connection returns threads in **chronological order**
(oldest first). When you query `reviewThreads(first: 100)`, you get the
**oldest 100** threads — which on a PR with 150+ threads are typically all
already resolved. New bot findings opened after a rebase or push are appended
at the **end** and only appear with `reviewThreads(last: 100)` or by paginating
`first:` to the end via `after:` cursors.

**Always use `last: 100`** for ad-hoc thread checks, or use the `pr-state.ts`
helper which paginates `first:` with cursors to exhaust all threads. Never
query `first: 100` alone on a PR with a long review history — you will
silently miss new unresolved findings and falsely report convergence.

## `MERGEABLE=UNKNOWN` cache note

If `MERGEABLE=UNKNOWN` in `pr-state.ts` output, the GraphQL
`mergeable` field is cached (computed asynchronously by GitHub's
merge-queue worker; see gh-cli #9583). Note that `mergeable` (merge
conflict status: `MERGEABLE`/`CONFLICTING`) and `mergeStateStatus`
(overall merge button state: `CLEAN`/`BLOCKED`/`DIRTY`/etc.) are
**separate** GraphQL fields and must not be conflated. The script
reads `mergeStateStatus` from the same GraphQL query as the other PR
fields, so a stale `mergeable` value does not block `/act` decisions.
