---
name: ci-local
description: Analyze CI/CD pipeline configuration and run checks locally before commit or push. Detects workflow files, extracts validation steps, executes them locally, and optionally auto-fixes issues.
---

# CI Local

## Overview

This skill analyzes CI/CD pipeline configuration (GitHub Actions, GitLab CI, Azure Pipelines, etc.) and runs validation checks locally before committing or pushing. This prevents CI failures and saves time by catching issues early.

## Workflow

### 1. Detect CI/CD Configuration

**Search for CI/CD configuration files:**

```bash
# GitHub Actions
find .github/workflows -name "*.yml" -o -name "*.yaml"

# GitLab CI
test -f .gitlab-ci.yml && echo ".gitlab-ci.yml"

# Azure Pipelines
find . -name "azure-pipelines.yml" -o -name "azure-pipelines.yaml"

# CircleCI
test -f .circleci/config.yml && echo ".circleci/config.yml"

# Jenkins
test -f Jenkinsfile && echo "Jenkinsfile"
```

**If no CI configuration found:**
- Inform user no CI checks detected
- Proceed without local validation
- Suggest adding CI configuration

### 2. Parse CI Configuration

**Extract validation steps from CI config:**

**GitHub Actions:**
```yaml
# Example: .github/workflows/ci.yml
jobs:
  lint:
    steps:
      - run: npm run lint
  test:
    steps:
      - run: npm test
  build:
    steps:
      - run: npm run build
```

**GitLab CI:**
```yaml
# Example: .gitlab-ci.yml
lint:
  script:
    - npm run lint
test:
  script:
    - npm test
```

**Parse and extract:**
- Job names
- Script commands
- Dependencies (install steps)
- Environment setup
- Validation commands (lint, test, build, type-check, etc.)

### 3. Categorize Checks

**Group checks by type:**

#### Linting
- ESLint, Prettier, Stylelint
- Markdown linting
- YAML/JSON validation
- Shell script linting

#### Type Checking
- TypeScript (`tsc --noEmit`)
- Flow
- MyPy (Python)

#### Testing
- Unit tests
- Integration tests
- E2E tests

#### Building
- Compilation
- Bundling
- Asset generation

#### Security
- Dependency scanning
- Secret scanning
- SAST tools

#### Other
- License checks
- Documentation generation
- Coverage reports

### 4. Determine Runnable Checks

**Filter checks that can run locally:**

**Runnable:**
- Linting (fast, no external dependencies)
- Type checking (fast, local)
- Unit tests (fast, local)
- Build (local, may be slow)

**Skip:**
- Deployment steps
- External service integration
- Cloud-specific operations
- Steps requiring secrets/credentials

**Inform user:**
- Which checks will run locally
- Which checks are skipped (and why)
- Estimated time for local checks

### 5. Execute Local Checks

**Run checks in order:**

```bash
# Install dependencies if needed
npm install  # or yarn, pnpm, etc.

# Run linting
npm run lint

# Run type checking
npm run type-check  # or tsc --noEmit

# Run tests
npm test

# Run build
npm run build
```

**For each check:**
- Report start
- Execute command
- Capture output
- Report result (pass/fail)
- Collect errors for auto-fix

**Stop on first failure** (unless --fix flag is set)

### 6. Report Results

**Summary of local CI checks:**

```
✅ CI Local Checks

Checks Run:
✅ Lint (eslint) - Passed
✅ Type Check (tsc) - Passed
✅ Unit Tests (jest) - Passed (42 tests)
✅ Build (webpack) - Passed

Checks Skipped:
⏭️ Deploy - Requires cloud credentials
⏭️ E2E Tests - Requires external services

All local checks passed! Safe to commit/push.
```

**If failures:**

```
❌ CI Local Checks Failed

Failed Checks:
❌ Lint (eslint) - 3 errors, 5 warnings
❌ Type Check (tsc) - 2 errors

Passed Checks:
✅ Unit Tests (jest) - Passed

Use --fix flag to attempt auto-fix, or fix manually before committing.
```

### 7. Auto-Fix (if --fix flag)

**Attempt to fix issues automatically:**

#### Linting Fixes
```bash
# ESLint
npm run lint -- --fix

# Prettier
npm run format

# Stylelint
npm run stylelint -- --fix
```

#### Type Checking Fixes
- Cannot auto-fix type errors
- Report errors for manual fix
- Suggest type annotations

#### Test Fixes
- Cannot auto-fix test failures
- Report failing tests
- Suggest debugging steps

#### Build Fixes
- Cannot auto-fix build errors
- Report build errors
- Suggest dependency updates

**After auto-fix:**
- Re-run checks to verify fixes
- Report which issues were fixed
- Report which issues remain

**If in commit mode (--fix with /commit):**
- Stage fixed files
- Include fixes in commit
- Report what was fixed in commit message

**If in push mode (--fix with /push):**
- Commit fixes separately
- Push fix commits along with original commits
- Report fix commits in push summary

### 8. Integration with Commit/Push

**When called from /commit --check:**
1. Run local CI checks before staging
2. If checks fail, abort commit
3. If --fix flag, auto-fix and include in commit
4. If checks pass, proceed with commit

**When called from /push --check:**
1. Run local CI checks before pushing
2. If checks fail, abort push
3. If --fix flag, auto-fix, commit fixes, and push all
4. If checks pass, proceed with push

## CI Platform Support

### GitHub Actions

**Parse `.github/workflows/*.yml`:**
- Extract `jobs.<job-id>.steps[].run` commands
- Detect `actions/setup-*` for environment setup
- Identify validation jobs (lint, test, build)

### GitLab CI

**Parse `.gitlab-ci.yml`:**
- Extract `<job>.script` commands
- Detect `before_script` for setup
- Identify validation stages

### Azure Pipelines

**Parse `azure-pipelines.yml`:**
- Extract `steps[].script` or `steps[].task` commands
- Detect setup steps
- Identify validation tasks

### CircleCI

**Parse `.circleci/config.yml`:**
- Extract `jobs.<job>.steps[].run` commands
- Detect setup steps
- Identify validation jobs

### Jenkins

**Parse `Jenkinsfile`:**
- Extract `sh` or `bat` commands from stages
- Detect setup steps
- Identify validation stages

## Examples

### Example 1: GitHub Actions with Lint and Test

**CI Config:**
```yaml
# .github/workflows/ci.yml
jobs:
  validate:
    steps:
      - run: npm install
      - run: npm run lint
      - run: npm test
```

**Local Execution:**
```bash
# Detected checks: lint, test
npm install
npm run lint  # ✅ Passed
npm test      # ✅ Passed (42 tests)
```

### Example 2: GitLab CI with Type Check

**CI Config:**
```yaml
# .gitlab-ci.yml
type-check:
  script:
    - npm run type-check
test:
  script:
    - npm test
```

**Local Execution:**
```bash
# Detected checks: type-check, test
npm run type-check  # ✅ Passed
npm test            # ✅ Passed
```

### Example 3: Auto-Fix Linting Issues

**CI Config:**
```yaml
jobs:
  lint:
    steps:
      - run: npm run lint
```

**Local Execution with --fix:**
```bash
npm run lint        # ❌ Failed (3 errors)
npm run lint --fix  # 🔧 Auto-fixed 3 errors
npm run lint        # ✅ Passed
```

## Integration with Other Skills

This skill works with:
- `.agents/skills/git-commit/SKILL.md` - Run checks before commit
- `.agents/skills/git-push/SKILL.md` - Run checks before push
- `.agents/rules/documentation.md` - Validate docs in CI
- `.agents/rules/project-structure.md` - Validate structure in CI

## Anti-Patterns

- Running all CI checks locally (some require cloud resources)
- Not informing user of skipped checks
- Auto-fixing without user confirmation
- Running slow checks (E2E tests) by default
- Not caching dependencies between checks

## Related Skills and Commands

- `.agents/commands/commit.md` - `/commit --check` and `/commit --fix`
- `.agents/commands/push.md` - `/push --check` and `/push --fix`

## Notes

- Only run fast, local checks by default
- Skip deployment, external services, cloud-specific steps
- Auto-fix only works for linting (not type errors or test failures)
- In commit mode, fixes are included in commit
- In push mode, fixes are committed separately and pushed
- Always inform user of what checks ran and what was skipped
