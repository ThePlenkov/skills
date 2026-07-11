---
description: Run local CI checks without committing or pushing
argument-hint: "--fix"
---

Run local CI validation checks without committing or pushing. Detects CI configuration, runs checks locally, and optionally auto-fixes issues.

**This command wraps the `ci-local` skill workflow.**

## Usage

```
/ci
/ci --fix
```

## Workflow

The agent will:
1. **Detect CI configuration** (GitHub Actions, GitLab CI, Azure Pipelines, etc.)
2. **Parse validation steps** (lint, type-check, test, build)
3. **Run checks locally** (skips deployment/cloud-specific steps)
4. **Report results** for each check
5. **Auto-fix issues** (if --fix flag)
6. **Report summary** (passed/failed/skipped checks)

## Flags

### --fix

**Auto-fix ANY failing check that can be fixed programmatically:**
- **Linting**: Code formatting, import sorting, unused code
- **Type errors**: Missing annotations, type imports, type mismatches
- **Test failures**: Outdated snapshots, assertion updates, mock data
- **Build errors**: Missing dependencies, import paths, module resolution
- **Dependencies**: Security vulnerabilities, outdated packages, conflicts

**After auto-fix:**
- Re-runs checks to verify fixes
- Reports what was fixed
- **Does NOT commit or push** (use /commit or /push for that)
- Leaves fixed files staged for manual review

## Examples

**Run CI checks:**
```
/ci
```

**Run CI checks and auto-fix issues:**
```
/ci --fix
```

## Use Cases

**Before committing:**
```
/ci --fix
# Review fixes
/commit <subject>
```

**Before pushing:**
```
/ci
# If checks pass
/push
```

**Quick validation:**
```
/ci
# Just check, don't fix or commit
```

## What Gets Checked

**Runnable locally:**
- ✅ Linting (ESLint, Prettier, Stylelint)
- ✅ Type checking (TypeScript, Flow, MyPy)
- ✅ Unit tests (Jest, Mocha, pytest)
- ✅ Build (webpack, tsc, cargo)
- ✅ Security (npm audit, dependency scanning)

**Skipped (requires cloud/external services):**
- ⏭️ Deployment steps
- ⏭️ E2E tests (if require external services)
- ⏭️ Cloud-specific operations
- ⏭️ Steps requiring secrets/credentials

## Full Workflow

See `.agents/skills/ci-local/SKILL.md` for the complete workflow including:

- CI configuration detection (all major platforms)
- Validation step parsing and categorization
- Local execution strategy
- Auto-fix strategies for all check types
- Result reporting and summary

## Related

- `.agents/skills/ci-local/SKILL.md` - Full CI local workflow
- `.agents/commands/commit.md` - `/commit --check --fix`
- `.agents/commands/push.md` - `/push --check --fix`

## Notes

- Does NOT commit or push automatically
- Use --fix to auto-fix issues without committing
- Review fixed files before committing
- Faster than waiting for CI to fail
- Catches issues early in development workflow
