# CI Optimization

When the pipeline exceeds 10 minutes, apply these strategies in order of
impact. The example YAML below each strategy matches the convention used in
`references/github-actions-config.md` (Node 22, `actions/setup-node@v4`,
`actions/checkout@v4`).

## Decision Tree

```
Slow CI pipeline?
├── Cache dependencies
│   └── Use actions/cache or setup-node cache option for node_modules
├── Run jobs in parallel
│   └── Split lint, typecheck, test, build into separate parallel jobs
├── Only run what changed
│   └── Use path filters to skip unrelated jobs (e.g., skip e2e for docs-only PRs)
├── Use matrix builds
│   └── Shard test suites across multiple runners
├── Optimize the test suite
│   └── Remove slow tests from the critical path, run them on a schedule instead
└── Use larger runners
    └── GitHub-hosted larger runners or self-hosted for CPU-heavy builds
```

## Caching and parallelism (concrete example)

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm test -- --coverage
```

Path filters for skipping unrelated jobs (e.g. E2E only on code changes):

```yaml
# IMPORTANT: a `paths` filter on `on.pull_request` skips the ENTIRE
# workflow for non-matching PRs. If the workflow also owns a required
# check (lint, typecheck, build), those checks go missing on a
# docs-only PR and the PR can sit with a "waiting for status" or
# blocked merge. Two safer patterns:
#
#   1. Put the gating jobs (lint/typecheck/build) in a separate
#      workflow that runs on every PR; put the E2E job in this
#      workflow with the path filter.
#   2. Use a separate path-filter step (e.g. `dorny/paths-filter`)
#      that exposes an `output` consumed by the E2E job. Do NOT
#      rely on `github.event.pull_request.changes.*.paths` — that
#      key is NOT present in the `pull_request` webhook payload, so
#      any `if:` over it evaluates to false for every PR and the
#      E2E job never runs.
#
# Example of pattern (2) with `dorny/paths-filter`:
on:
  pull_request:

# Explicit permissions. Repositories with restricted default
# `GITHUB_TOKEN` permissions will see the path-filter job fail
# silently in `pull_request` mode without `contents: read` (to
# check out the head SHA) and `pull-requests: read` (to read
# the PR's changed-files list). The change-detection step then
# never produces its outputs and the gated job never runs —
# the same failure mode as the `filter:` vs `filters:` typo
# but with a different cause. Add the block at the workflow
# level (or on each job that needs it).
permissions:
  contents: read
  pull-requests: read

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      e2e: ${{ steps.filter.outputs.e2e }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          # The action's required input is `filters:` (plural), not
          # `filter:` — the singular form is silently ignored and
          # the change-detection step never produces the `e2e`
          # output, so the gated job never runs. The action also
          # accepts a `token` for fork PRs; the `base` input is
          # IGNORED for the `pull_request` event (it only takes
          # effect on `push`), so do not rely on it here — the
          # action always diffs against the PR's base SHA.
          filters: |
            e2e:
              - 'src/**'
              - 'tests/**'
              - 'package.json'
              - 'package-lock.json'

  e2e:
    needs: changes
    if: ${{ needs.changes.outputs.e2e == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npx playwright test
```

If you do not need path filtering at all, prefer a single workflow
that runs on every PR — it is simpler to reason about and avoids the
"required check disappeared" failure mode entirely.

Matrix sharding (Playwright example):

```yaml
jobs:
  e2e:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - run: npx playwright test --shard=${{ matrix.shard }}/4
```
