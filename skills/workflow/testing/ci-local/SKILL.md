---
name: ci-local
description: Analyze CI/CD pipeline configuration and run checks locally before commit or push. Detects workflow files, extracts validation steps, executes them locally, and attempts to auto-fix ANY failing check that can be fixed programmatically.
---

# CI Local

Run CI checks locally before commit/push. When failures occur, auto-fix what can be fixed programmatically (lint, types, tests, build, dependencies).

For GitHub Actions, prefer [gh-act](https://github.com/nektos/gh-act) when available — it runs real workflows via Docker.

## Workflow

### 1. Detect CI configuration

Use the detection commands in [references/ci-platforms.md](references/ci-platforms.md). If nothing found, inform the user and proceed without local validation.

### 2. Decide the runner

**GitHub Actions**: prefer `gh act` when installed (`gh extension list | grep nektos/gh-act`, fall back to `act --version`). See [references/gh-act-setup.md](references/gh-act-setup.md) for installation and image selection.

**All other platforms**: parse the workflow file directly (see references/ci-platforms.md).

### 3. Categorize, filter, execute

1. **Categorize** each check: lint, type, test, build, security, other.
2. **Filter runnable ones**: skip deploy, external services, cloud steps, anything requiring secrets.
3. **Run fast checks first**, stop on first failure unless `--fix` was passed.
4. **Capture** stdout + stderr; parse error messages; collect failures for the auto-fix step.

### 4. Auto-fix (when `--fix`)

Loop per failing check: analyze the error, apply the strategy in [references/auto-fix-strategies.md](references/auto-fix-strategies.md), re-run that check, then re-run the full set.

In commit mode (`/commit --fix`): stage fixes with the same commit.
In push mode (`/push --fix`): commit fixes separately and include them in the push.

### 5. Report

```
✅ CI Local Checks
Lint (eslint)        — Passed
Type Check (tsc)     — Passed
Unit Tests (jest)    — Passed (42 tests)
Build (webpack)      — Passed
Skipped: Deploy (cloud creds), E2E (external services)
```

Or, on failure:

```
❌ CI Local Checks Failed
Lint (eslint)        — 3 errors, 5 warnings
Type Check (tsc)     — 2 errors
Unit Tests (jest)    — 1 failed
Build (webpack)      — Compilation error
```

## GitHub Actions: gh-act quick path

```bash
gh act --list                              # preview
gh act --dryrun                            # confirm steps
gh act -j lint                             # run one job
gh act -j shellcheck -j markdownlint
gh act --secret-file .secrets              # if needed
```

Always create `.actrc` so the first run does not prompt interactively:

```
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
```

For full installation, image sizes, and alternatives — see references/gh-act-setup.md.

## Fallback manual extraction

When `act` is unavailable or for non-GH CI:

```bash
npm install            # or yarn / pnpm
npm run lint
npm run type-check     # or tsc --noEmit
npm test
npm run build
```

Per platform parsing rules: [references/ci-platforms.md](references/ci-platforms.md).

## Failure recovery

For gh-act issues (Docker, image pulls, permissions, missing workflows): [references/troubleshooting.md](references/troubleshooting.md).

For per-check-type auto-fix strategies: [references/auto-fix-strategies.md](references/auto-fix-strategies.md).

## Anti-patterns

- Running all CI checks locally (some require cloud resources).
- Not reporting skipped checks.
- Auto-fixing without user confirmation.
- Running slow E2E tests by default.
- Using Large image when Medium suffices.
- Missing `.actrc`, causing interactive prompts.

## Integration

- `$skill{git-commit}` — runs this before commit when `--check`/`--fix`.
- `$skill{git-push}` — runs this before push when `--check`/`--fix`.
- See `.agents/rules/branch-workflow.md`, `.agents/rules/documentation.md`.

## Notes

- Default to fast local checks; skip deploy, external, cloud.
- Auto-fix works for anything fixable programmatically — not just lint.
- Always report what ran, what was skipped, what was auto-fixed, what remains.
