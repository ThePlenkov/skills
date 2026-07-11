---
name: ci-local
description: Analyze CI/CD pipeline configuration and run checks locally before commit or push. Detects workflow files, extracts validation steps, executes them locally, and attempts to auto-fix ANY failing check that can be fixed programmatically.
---

# CI Local

## Overview

This skill analyzes CI/CD pipeline configuration (GitHub Actions, GitLab CI, Azure Pipelines, etc.) and runs validation checks locally before committing or pushing. When checks fail, it attempts to auto-fix ANY issue that can be resolved programmatically - not just linting, but also build errors, test failures, type errors, and more.

**For GitHub Actions, this skill uses [gh-act](https://github.com/nektos/gh-act) when available** - a tool that runs GitHub Actions workflows locally using Docker. This provides the most accurate local CI execution, including matrix builds, services, caching, and all GitHub Actions features.

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

**For GitHub Actions, check if gh-act is available:**

```bash
# Check if act is installed
act --version 2>/dev/null

# If available, prefer act for most accurate local execution
# If not available, fall back to manual command extraction
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

#### Option A: Using gh-act (GitHub Actions only, preferred)

**If `act` is available and GitHub Actions detected:**

```bash
# List all available jobs
gh act --list

# Run all workflows
gh act

# Run specific workflow
gh act -W .github/workflows/ci.yml

# Run specific job(s)
gh act -j lint
gh act -j shellcheck -j markdownlint

# Dry run (see what would execute without running)
gh act --dryrun

# Run with secrets
gh act --secret-file .secrets

# Run specific event
gh act push
gh act pull_request
```

**Benefits of gh-act:**
- ✅ Runs actual GitHub Actions workflows (100% accuracy)
- ✅ Supports matrix builds, services, caching
- ✅ Uses same Docker images as GitHub runners
- ✅ Handles secrets, environment variables, artifacts
- ✅ No need to parse YAML or extract commands
- ✅ Fast feedback loop (no push to GitHub needed)

**Best practices:**
- Use `--dryrun` first to verify what will execute
- Create `.actrc` to avoid interactive prompts
- Use Medium image for best compatibility/size balance
- Run specific jobs (`-j`) to save time
- Keep Docker running for faster execution

**Installation (if not available):**

### Recommended: GitHub CLI Extension (easiest)

```bash
gh extension install nektos/gh-act
```

**Alternative methods:**
```bash
# macOS
brew install act

# Windows (using Chocolatey)
choco install act-cli

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Manual: Download from https://github.com/nektos/act/releases
```

**Configuration (skip interactive prompt):**
Create `.actrc` in project root:
```
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
```

**Image options:**
- **Micro** (~200MB): `node:16-buster-slim` - NodeJS only, limited compatibility
- **Medium** (~500MB): `ghcr.io/catthehacker/ubuntu:act-latest` - Recommended, most compatible
- **Large** (~18GB): `ghcr.io/catthehacker/ubuntu:full-latest` - Full GitHub runner snapshot

**Requirements:**
- Docker must be installed and running
- Sufficient disk space for runner images (500MB-18GB depending on image)
- First run downloads selected image

#### Option B: Manual Command Extraction (fallback)

**If `act` is not available or for non-GitHub Actions CI:**

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
- Capture output (stdout + stderr)
- Parse error messages
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
❌ Unit Tests (jest) - 1 test failed
❌ Build (webpack) - Compilation error

Passed Checks:
✅ (none)

Use --fix flag to attempt auto-fix, or fix manually before committing.
```

### 7. Auto-Fix (if --fix flag)

**Note on gh-act compatibility:**
When using `act` to run workflows, auto-fix works by:
1. Running workflow with `act` to detect failures
2. Parsing `act` output for error messages
3. Applying fixes using strategies below
4. Re-running workflow with `act` to verify fixes

**Attempt to fix ANY issue that can be resolved programmatically:**

#### Linting Fixes
```bash
# ESLint
npm run lint -- --fix

# Prettier
npm run format

# Stylelint
npm run stylelint -- --fix
```

**Auto-fixable:**
- Code formatting issues
- Import sorting
- Unused imports
- Missing semicolons
- Trailing whitespace

#### Type Checking Fixes
```bash
# Add missing type annotations
# Fix type mismatches
# Add type imports
```

**Auto-fixable:**
- Missing type annotations (infer from usage)
- Implicit any (add explicit types)
- Missing imports for types
- Type assertion fixes

**Strategies:**
- Analyze error messages for missing types
- Infer types from usage context
- Add type imports automatically
- Use type inference where possible

#### Test Fixes
```bash
# Update snapshots
npm test -- -u

# Fix test assertions
# Update expected values
```

**Auto-fixable:**
- Outdated snapshots
- Expected values that changed
- Mock data updates
- Test data synchronization

**Strategies:**
- Update snapshots if code change is intentional
- Analyze test failures for assertion mismatches
- Update expected values based on actual output
- Regenerate test fixtures

#### Build Fixes
```bash
# Install missing dependencies
npm install <missing-package>

# Update dependencies
npm update

# Fix import paths
# Resolve module resolution issues
```

**Auto-fixable:**
- Missing dependencies
- Outdated dependencies
- Import path errors
- Module resolution issues
- Asset path errors

**Strategies:**
- Parse build errors for missing modules
- Install missing dependencies automatically
- Update import paths based on file moves
- Fix asset references

#### Dependency Fixes
```bash
# Update vulnerable dependencies
npm audit fix

# Update outdated dependencies
npm update

# Resolve dependency conflicts
```

**Auto-fixable:**
- Security vulnerabilities
- Outdated dependencies
- Dependency conflicts
- Peer dependency issues

#### Other Fixes
- Documentation generation errors
- License header additions
- Code coverage threshold adjustments
- Configuration file updates

### 8. Auto-Fix Workflow

**For each failing check:**

1. **Analyze error output**
   - Parse error messages
   - Identify error type
   - Determine if auto-fixable

2. **Attempt fix**
   - Apply appropriate fix strategy
   - Execute fix command/script
   - Verify fix applied

3. **Re-run check**
   - Execute same check again
   - Verify it now passes
   - Report fix result

4. **Collect fixes**
   - Track what was fixed
   - Track what couldn't be fixed
   - Prepare fix summary

**After all auto-fix attempts:**
- Re-run ALL checks to verify
- Report which issues were fixed
- Report which issues remain
- Provide manual fix guidance for remaining issues

**If in commit mode (--fix with /commit):**
- Stage fixed files
- Include fixes in commit
- Report what was fixed in commit message

**If in push mode (--fix with /push):**
- Commit fixes separately
- Push fix commits along with original commits
- Report fix commits in push summary

### 9. Integration with Commit/Push

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

## Auto-Fix Strategies by Check Type

### Linting
- Run linter with --fix flag
- Apply code formatter
- Sort imports
- Remove unused code

### Type Checking
- Infer types from usage
- Add explicit type annotations
- Import missing types
- Add type assertions where safe

### Testing
- Update snapshots
- Fix assertion values
- Update mock data
- Regenerate fixtures

### Building
- Install missing dependencies
- Update import paths
- Fix module resolution
- Update asset references

### Dependencies
- Update vulnerable packages
- Resolve conflicts
- Update outdated packages
- Fix peer dependencies

### Security
- Update vulnerable dependencies
- Remove exposed secrets
- Fix insecure patterns
- Update security configurations

## CI Platform Support

### GitHub Actions

### Primary Method: gh-act (nektos/act)

When `act` is available, use it to run GitHub Actions workflows locally:

```bash
# Run all workflows
act

# Run specific workflow
act -W .github/workflows/ci.yml

# Run specific job
act -j test

# List available jobs
act -l

# Dry run
act --dryrun
```

**Benefits:**
- Runs actual workflows (no parsing needed)
- Supports all GitHub Actions features
- Uses same Docker images as GitHub runners
- Handles matrix builds, services, secrets, artifacts

### Fallback Method: Manual Parsing

If `act` is not available, parse `.github/workflows/*.yml`:
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

### Example 1: Auto-Fix Linting and Type Errors

**CI Checks:**
```bash
npm run lint        # ❌ Failed (3 errors)
npm run type-check  # ❌ Failed (2 type errors)
npm test            # ✅ Passed
```

**Auto-Fix:**
```bash
npm run lint --fix  # 🔧 Fixed 3 errors
# Analyze type errors, add missing type annotations
npm run type-check  # ✅ Now passes
```

### Example 2: Auto-Fix Test Snapshots

**CI Checks:**
```bash
npm test  # ❌ Failed (3 snapshot mismatches)
```

**Auto-Fix:**
```bash
npm test -- -u  # 🔧 Updated 3 snapshots
npm test        # ✅ Now passes
```

### Example 3: Auto-Fix Build Errors

**CI Checks:**
```bash
npm run build  # ❌ Failed (missing dependency 'lodash')
```

**Auto-Fix:**
```bash
npm install lodash  # 🔧 Installed missing dependency
npm run build       # ✅ Now passes
```

## Integration with Other Skills

This skill works with:
- `.agents/skills/git-commit/SKILL.md` - Run checks before commit
- `.agents/skills/git-push/SKILL.md` - Run checks before push
- `.agents/rules/documentation.md` - Validate docs in CI
- `.agents/rules/project-structure.md` - Validate structure in CI

## Troubleshooting gh-act

### Interactive Prompt on First Run
**Problem:** `act` prompts for Docker image selection on first run

**Solution:** Create `.actrc` in project root:
```
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
```

### Docker Not Running
**Problem:** `act` fails with "Cannot connect to Docker daemon"

**Solution:**
- Start Docker Desktop (Windows/Mac)
- Or start Docker service: `sudo systemctl start docker` (Linux)

### Image Pull Timeout
**Problem:** Docker image download times out or is very slow

**Solution:**
- Use smaller image (Medium instead of Large)
- Check network connection
- Use `--pull=false` to skip pull if image exists

### Permission Denied
**Problem:** `act` fails with permission errors

**Solution:**
- Add user to docker group: `sudo usermod -aG docker $USER`
- Or run with sudo (not recommended)

### Workflow Not Found
**Problem:** `act` reports "no workflows found"

**Solution:**
- Verify `.github/workflows/` directory exists
- Check workflow files have `.yml` or `.yaml` extension
- Ensure workflows have valid YAML syntax

## Anti-Patterns

- Running all CI checks locally (some require cloud resources)
- Not informing user of skipped checks
- Auto-fixing without user confirmation
- Running slow checks (E2E tests) by default
- Not caching dependencies between checks
- Assuming only linting can be auto-fixed
- Not creating `.actrc` (causes interactive prompts)
- Using Large image when Medium suffices (wastes disk space)

## Related Skills and Commands

- `.agents/commands/commit.md` - `/commit --check` and `/commit --fix`
- `.agents/commands/push.md` - `/push --check` and `/push --fix`

## Notes

- Only run fast, local checks by default
- Skip deployment, external services, cloud-specific steps
- Auto-fix works for ANY check that can be fixed programmatically
- Not just linting - also type errors, test failures, build errors, dependencies
- In commit mode, fixes are included in commit
- In push mode, fixes are committed separately and pushed
- Always inform user of what checks ran and what was skipped
- Always report what was auto-fixed and what remains