---
name: ci-cd-and-automation
description: Automates CI/CD pipeline setup. Use when setting up or modifying build and deployment pipelines. Use when you need to automate quality gates, configure test runners in CI, or establish deployment strategies.
---

# CI/CD and Automation

## Overview

Automate quality gates so that no change reaches production without passing
tests, lint, type checking, and build. CI/CD is the enforcement mechanism for
every other skill — it catches what humans and agents miss, and it does so
consistently on every single change.

**Shift Left:** Catch problems as early in the pipeline as possible. A bug
caught in linting costs minutes; the same bug caught in production costs
hours. Move checks upstream — static analysis before tests, tests before
staging, staging before production.

**Faster is Safer:** Smaller batches and more frequent releases reduce risk,
not increase it. A deployment with 3 changes is easier to debug than one
with 30. Frequent releases build confidence in the release process itself.

## When to Use

- Setting up a new project's CI pipeline
- Adding or modifying automated checks
- Configuring deployment pipelines
- When a change should trigger automated verification
- Debugging CI failures

## The Quality Gate Pipeline

Every change goes through these gates before merge:

```
Pull Request Opened
    │
    ▼
┌─────────────────┐
│   LINT CHECK     │  eslint, prettier
│   ↓ pass         │
│   TYPE CHECK     │  tsc --noEmit
│   ↓ pass         │
│   UNIT TESTS     │  jest/vitest
│   ↓ pass         │
│   BUILD          │  npm run build
│   ↓ pass         │
│   INTEGRATION    │  API/DB tests
│   ↓ pass         │
│   E2E (optional) │  Playwright/Cypress
│   ↓ pass         │
│   SECURITY AUDIT │  npm audit
│   ↓ pass         │
│   BUNDLE SIZE    │  bundlesize check
└─────────────────┘
    │
    ▼
  Ready for review
```

**No gate can be skipped.** If lint fails, fix lint — don't disable the rule.
If a test fails, fix the code — don't skip the test.

## GitHub Actions Configuration

The full copy-paste-ready workflows (basic CI, DB integration, E2E,
caching/parallelism) live in
[`references/github-actions-config.md`](references/github-actions-config.md).
Reach for them as the canonical templates when wiring up a new pipeline.

## Feeding CI Failures Back to Agents

The CI feedback loop only works if failures come back with enough context
to act on. See
[`references/feeding-ci-failures.md`](references/feeding-ci-failures.md)
for the loop and the per-failure-type patterns.

## Deployment Strategies

Preview deploys, feature flags, staged rollouts, and rollback playbooks
live in [`references/deployment-strategies.md`](references/deployment-strategies.md).
Pick the smallest mechanism that matches the risk of the change — a docs
typo does not need a canary, a payment path probably does.

## Environment Management

```
.env.example       → Committed (template for developers)
.env                → NOT committed (local development)
.env.test           → Committed (test environment, no real secrets)
CI secrets          → Stored in GitHub Secrets / vault
Production secrets  → Stored in deployment platform / vault
```

CI should never have production secrets. Use separate secrets for CI testing.

## Automation Beyond CI

### Dependabot / Renovate

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
```

For upgrade discipline (one dep per change, changelog review, lockfile
hygiene) see the $skill{review-methodology} skill.

## Build Cop Role

Designate someone responsible for keeping CI green. When the build breaks,
the Build Cop's job is to fix or revert — not the person whose change caused
the break. This prevents broken builds from accumulating while everyone
assumes someone else will fix it.

### PR Checks

- **Required reviews:** At least 1 approval before merge
- **Required status checks:** CI must pass before merge
- **Branch protection:** No force-pushes to main
- **Auto-merge:** If all checks pass and approved, merge automatically

## CI Optimization

When the pipeline exceeds 10 minutes, apply strategies in order of impact:
cache dependencies, parallelise jobs, gate by path, shard test suites,
optimise the test suite, then reach for larger runners. Concrete patterns
and examples live in
[`references/ci-optimization.md`](references/ci-optimization.md).

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "CI is too slow" | Optimize the pipeline (see CI Optimization below), don't skip it. A 5-minute pipeline prevents hours of debugging. |
| "This change is trivial, skip CI" | Trivial changes break builds. CI is fast for trivial changes anyway. |
| "The test is flaky, just re-run" | Flaky tests mask real bugs and waste everyone's time. Fix the flakiness. |
| "We'll add CI later" | Projects without CI accumulate broken states. Set it up on day one. |
| "Manual testing is enough" | Manual testing doesn't scale and isn't repeatable. Automate what you can. |

## Red Flags

- No CI pipeline in the project
- CI failures ignored or silenced
- Tests disabled in CI to make the pipeline pass
- Production deploys without staging verification
- No rollback mechanism
- Secrets stored in code or CI config files (not secrets manager)
- Long CI times with no optimization effort

## Verification

After setting up or modifying CI:

- [ ] All quality gates are present (lint, types, tests, build, audit)
- [ ] Pipeline runs on every PR and push to main
- [ ] Failures block merge (branch protection configured)
- [ ] CI results feed back into the development loop
- [ ] Secrets are stored in the secrets manager, not in code
- [ ] Deployment has a rollback mechanism
- [ ] Pipeline runs in under 10 minutes for the test suite
