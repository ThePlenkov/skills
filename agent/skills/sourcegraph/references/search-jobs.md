# `src search-jobs` — async large-scale search

For searches that would hit the default 1-minute timeout — all
branches, all revisions, every repo in the org — use the async
search-jobs subcommand. The job runs in the background and
streams results to object storage; the CLI returns immediately
with a job ID.

## Three calls per job

```sh
# 1. Create — returns a job ID
src search-jobs create 'patternType:regexp secret lang:go'

# 2. Poll for status
src search-jobs get j123

# 3. Fetch results when state is COMPLETED
src search-jobs results j123
```

## States

`PROCESSING` → `COMPLETED` | `ERROR` | `CANCELED`.

Error codes include `ERROR_QUOTA_EXCEEDED`,
`ERROR_TOKEN_LIMIT_EXCEEDED`.

## When to use search-jobs

- Cross-repo + cross-branch search where `src search` times out
- Building a snapshot for offline processing
- Refactor analysis (find all callers of a function across the
  org's entire history)
- Compliance / secret scanning at scale

## When NOT to use

- Single-repo, default-branch search — `src search` is faster
- Anything that fits in a 1-minute timeout

## Architecture (for debugging)

Search jobs are executed by the `worker` service in parallel.
Results are stored in object storage (default: bundled `blobstore`,
or S3/GCS in production). The user downloads results from
`/search-jobs` UI as JSON Lines.

**Config knobs** (admin-side):

| Variable | Default | Description |
|---|---|---|
| `SRC_SEARCH_JOB_WORKER_INTERVAL` | `1s` | Frequency the worker checks for new jobs |
| `SRC_SEARCH_JOB_MAXIMUM_RUNTIME_PER_JOB` | `5h` | Max time for a single repository-revision search pair |
| `SRC_SEARCH_JOB_NUM_HANDLERS` | `5` | Parallelism of searches; increasing this pressures `Searcher` and `Zoekt` |
| `DISABLE_SEARCH_JOBS` | `false` | Set `true` in frontend and worker to disable |

**Known limitations:**

- `file:has.*` predicates are **not supported** in search jobs
- The 5h per-pair timeout is the default; an admin can raise
  `SRC_SEARCH_JOB_MAXIMUM_RUNTIME_PER_JOB` for bigger jobs
