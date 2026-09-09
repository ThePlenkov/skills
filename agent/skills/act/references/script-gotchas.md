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

## GitLab helpers use REST, not GraphQL (issue #284)

The `review-*` GitLab paths call the **REST v4 API** exclusively. Do
not mix GraphQL IDs into the `--file` inputs:

- `review-state.ts` emits REST discussion IDs (e.g. `6a9c1750b37d…`).
  `review-resolve.ts --file` and `review-reply.ts --file` consume
  those same REST IDs — the REST
  `PUT …/discussions/:discussion_id?resolved=true` and
  `POST …/discussions/:discussion_id/notes` endpoints accept them
  verbatim. Passing a GraphQL global ID (`gid://gitlab/Discussion/…`)
  will 404.
- `set-review-state.ts` toggles draft via the `Draft:`/`WIP:` title
  prefix (GitLab REST `PUT /merge_requests/:iid` has no `draft`
  boolean param). It fetches the title, rewrites the prefix, and PUTs
  it back — so a concurrent title edit can race. Do not run two
  `/act` sessions on the same MR.
- GitLab SAST extraction (`extract-findings.ts`) uses
  `/merge_requests/:iid/vulnerability_findings`, which is
  **Ultimate-tier**. On lower tiers it 404s and the script emits zero
  `code_scan` findings (review findings still work). This is honest
  degradation, not a bug.
- `submit-scores.ts` builds the `pr_url` column from the detected
  provider: `https://gitlab.com/<project>/-/merge_requests/<iid>` for
  GitLab, `https://github.com/<owner>/<repo>/pull/<pr>` for GitHub.
  For GitLab subgroups, pass `GROUP/SUBGROUP` as the first arg and
  `PROJECT` as the second.
