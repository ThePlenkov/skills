# GitHub Actions Configuration

Full copy-paste-ready CI workflows. The body of the skill points here for the
exact YAML; this file is where to copy from.

## Basic CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Test
        run: npm test -- --coverage

      - name: Build
        run: npm run build

      - name: Security audit
        run: npm audit --audit-level=high
```

## With Database Integration Tests

The Postgres service requires a non-empty `POSTGRES_PASSWORD` —
GitHub supplies an empty string for a missing secret, which makes
the image exit on startup. There are two patterns:

(a) **Read a repo secret.** Keep a `CI_DB_PASSWORD` repo secret
that all CI runs can read. This DOES NOT work for **external-fork
PRs** — a fork PR sees an empty string for the secret (GitHub
does not propagate repo secrets to forks for security reasons),
and the integration job fails on every fork PR. Use this only
when the PR workflow is internal-only, or when fork failures are
acceptable.

(b) **Bake a known CI-only ephemeral credential.** Hardcode a
password in the workflow. Acceptable for CI-only test
infrastructure; do not reuse this password in any non-test
environment. This DOES work for fork PRs because the value is
in the workflow file, not a secret.

For a public repo where fork PRs must run end-to-end, pattern (b)
is the only safe default; use pattern (a) only on internal repos
or where fork PRs are filtered out before the integration job.

```yaml
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: ci_user
          # Either: read the secret (fork PRs see an empty string
          # unless the secret is configured for the fork's repo).
          # POSTGRES_PASSWORD: ${{ secrets.CI_DB_PASSWORD }}
          # Or: hardcode a known CI-only credential. Fine for
          # internal pipelines; do not reuse this password in any
          # non-test environment.
          POSTGRES_PASSWORD: ci-only-ephemeral-password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://ci_user:ci-only-ephemeral-password@localhost:5432/testdb
      - name: Integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://ci_user:ci-only-ephemeral-password@localhost:5432/testdb
```

> **Note:** Even for CI-only test databases, use a value that is
> never reused in any other environment. The password is part of
> the test infrastructure, not a real secret; baking it into the
> workflow file is acceptable as long as it stays a CI-only value.

## E2E Tests

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      - name: Build
        run: npm run build
      - name: Run E2E tests
        run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Caching and parallelism (used in `references/ci-optimization.md`)

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
