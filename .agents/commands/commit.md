---
description: Commit changes with validation of documentation and project structure
argument-hint: --check --fix <subject>
---

Commit changes after analyzing git tree, validating documentation updates and project structure compliance, and optionally running local CI checks.

**This command wraps the `git-workflow-and-versioning` skill workflow.**

## Usage

```
/commit <subject>
/commit --check <subject>
/commit --fix <subject>
/commit --check --fix <subject>
```

**Examples:**
```
/commit user authentication
/commit --check API refactoring
/commit --fix documentation updates
/commit --check --fix memory migration
```

## Flags

### --check

**Run local CI checks before committing:**
- Detects CI configuration (GitHub Actions, GitLab CI, Azure Pipelines, etc.)
- Parses validation steps (lint, type-check, test, build)
- Runs checks locally (skips deployment/cloud-specific steps)
- Reports results for checks that ran (ci-local stops on first failure unless --fix is set)
- **Aborts commit if checks fail** (unless --fix flag)

**Use when:**
- You want to catch CI failures before pushing
- You're working on a project with strict CI requirements
- You want to ensure code quality before committing

### --fix

**Auto-fix linting failures:**
- Implies --check (runs CI checks first)
- Attempts to fix linting/formatting issues:
  - **Linting**: Code formatting, import sorting, unused code
  - **Type errors, tests, and build are NOT auto-fixed** — these still abort the commit
- Re-runs checks after auto-fix
- **Includes fixes in commit**
- Mentions fixes in commit message body
- **Aborts commit if auto-fix fails**

**Use when:**
- You have any CI failures that can be auto-fixed
- You want to ensure clean commits
- You're confident in auto-fix strategies

**Note:** Not all failures can be auto-fixed. Complex logic errors, design issues, and some test failures require manual intervention.

## Workflow

The agent will:
1. **Analyze git tree** to determine what changed
2. **Run local CI checks** (if --check flag)
   - Detect CI configuration
   - Parse validation steps
   - Run checks locally
   - Report results
3. **Auto-fix linting** (if --fix flag)
   - Fix linting and formatting issues
   - Re-run checks
   - Stage fixed files
4. **Validate changes** against documentation and structure rules
5. **Generate commit message** following conventional commits and project rules
6. **Stage appropriate files** (respecting .gitignore)
7. **Create commit(s)** - may break into component-based commits for monorepos
8. **Report commit hash(es)** and summary

## Commit Message Generation

The agent generates commit messages following:
- **Conventional Commits** format (unless project specifies otherwise)
- **Project-specific rules** from CONTRIBUTING.md, AGENTS.md, README.md
- **Ticket references** (Jira, GitHub, GitLab, Azure DevOps) when applicable
- **Component scopes** for monorepos (triggers semver automation)
- **Auto-fix mentions** (if --fix flag used)

**Message format:**
```
<type>(<scope>): <subject>

<body>
- Auto-fixed linting issues (3 errors)
- Auto-fixed type errors (2 missing annotations)
- Updated test snapshots (1 snapshot)

<footer>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

**Breaking changes:** Add `!` after type/scope: `feat!:` or `feat(api)!:`

## Component-Based Commits (Monorepos)

For changes spanning multiple components, the agent may create separate commits:
- `feat(client): add user profile page`
- `fix(server): resolve auth token expiry`
- `docs: update API documentation`

This triggers correct semver bumps per component (Nx, Lerna, Changesets).

## Full Workflow

See `.agents/skills/git-workflow-and-versioning/SKILL.md` for the complete workflow including:

- Git tree analysis and change categorization
- Local CI checks (--check flag)
- Auto-fix workflow for auto-fixable check types (--fix flag)
- Pre-commit validation checklist (documentation + structure)
- Conventional commits format and examples
- Component-based commit strategy
- Ticket reference patterns
- Code formatting (if applicable)

## Precondition Rules

This command enforces:
- `.agents/rules/documentation.md` - Documentation must be updated
- `.agents/rules/project-structure.md` - Structure must be maintained
- `.agents/skills/ci-local/SKILL.md` - Local CI checks (if --check flag)

**Never skip validation.** If validation fails, fix issues before committing.

## Related

- `.agents/skills/git-workflow-and-versioning/SKILL.md` - Full workflow implementation
- `.agents/skills/ci-local/SKILL.md` - Local CI checks and auto-fix
- `.agents/rules/documentation.md` - Documentation validation rules
- `.agents/rules/project-structure.md` - Structure validation rules
