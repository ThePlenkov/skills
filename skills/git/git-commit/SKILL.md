---
name: git-commit
description: Create git commits with validation of documentation and project structure. Analyzes git tree to determine what changed, generates conventional commit messages respecting project rules, and optionally breaks commits by component for semver automation. Supports --check flag to run CI checks locally and --fix flag to auto-fix issues.
---

# Git Commit

## Workflow

### 1. Analyze Git Tree

**Determine what changed** by inspecting the repository:

```bash
git status -sb
git diff --stat
git diff --name-only
```

**Categorize changes:**
- Modified files by directory/component
- New files and their purpose
- Deleted files and impact
- Configuration changes
- Documentation updates

**Detect components** (for monorepos):
- Check workspace structure (`package.json`, `pnpm-workspace.yaml`, `nx.json`)
- Group changes by package/app/lib
- Identify if changes span multiple components

### 2. Run Local CI Checks (if --check flag)

**If --check flag is provided**, run local CI checks before committing:

1. **Invoke ci-local skill** — $ci-local
2. **Detect CI configuration** (GitHub Actions, GitLab CI, etc.)
3. **Parse and extract validation steps** (lint, type-check, test, build)
4. **Run checks locally** (skip deployment/cloud-specific steps)
5. **Report results** (pass/fail for checks that ran — ci-local stops on first failure unless --fix is set)

**If checks fail:**
- Report which checks failed
- Show error details
- If --fix flag NOT provided: **Abort commit**
- If --fix flag provided: **Proceed to auto-fix**

**If checks pass:**
- Report success
- Proceed with commit workflow

### 3. Auto-Fix Issues (if --fix flag)

**If --fix flag is provided and checks failed:**

1. **Attempt auto-fix** (see ci-local skill for details)
   - Linting: `npm run lint --fix`, `npm run format`
   - Other types (type checking, tests, build) may require manual intervention

2. **Re-run checks** after auto-fix
3. **Stage fixed files** for inclusion in commit
4. **Report what was fixed**

**If auto-fix succeeds:**
- Include fixes in commit
- Mention fixes in commit message body

**If auto-fix fails:**
- Report remaining issues
- **Abort commit**
- User must fix manually

### 4. Pre-Commit Validation

**Before staging or committing**, validate changes against documentation and structure rules:

#### Documentation Updates (see `.agents/rules/documentation.md`)

**File Operations:**
- [ ] Moved files → all references updated (imports, links, paths)
- [ ] Renamed files → references updated in docs, configs, code
- [ ] Deleted files → removed from indexes, dependent docs updated
- [ ] New files → added to relevant indexes or README sections

**Code Changes:**
- [ ] Refactoring → architecture docs, diagrams, examples updated
- [ ] API changes → API docs, OpenAPI specs, usage examples updated
- [ ] New features → added to README, feature lists updated
- [ ] Breaking changes → migration guides, CHANGELOG updated

**Configuration Changes:**
- [ ] Build config → setup instructions updated
- [ ] Dependencies → installation docs, version requirements updated
- [ ] Environment variables → `.env.example`, setup guides updated
- [ ] CI/CD → workflow documentation updated

**Structural Changes:**
- [ ] Directory reorganization → layout sections in README/AGENTS.md updated
- [ ] New directories → purpose documented in parent README or AGENTS.md
- [ ] Removed directories → layout documentation updated

#### Project Structure Compliance (see `.agents/rules/project-structure.md`)

**New Files/Directories:**
- [ ] Location justified per project structure documentation
- [ ] Root additions have documented reason
- [ ] Monorepo compliance (packages/apps in workspace directories)
- [ ] Structure documentation updated for new additions

**Temporary Files:**
- [ ] No `tmp/`, `temp/`, `*.tmp`, `*.bak` files committed
- [ ] `.gitignore` updated for new temp directories
- [ ] Build artifacts excluded (`dist/`, `build/`, `node_modules/`)

**Helper Scripts:**
- [ ] Scripts in proper location (`scripts/`, `tools/`, or equivalent)
- [ ] No loose scripts in root directory
- [ ] Script purpose documented (README or inline)
- [ ] Executable permissions set if needed

**Structure Consistency:**
- [ ] New additions follow existing patterns
- [ ] No structural drift from documentation
- [ ] Cross-references between files still valid

#### Validation Commands

Run these to detect issues:

```bash
# Check for temp files
git diff --name-only | grep -E '\.(tmp|temp|bak|swp)$'

# Check for build artifacts
git diff --name-only | grep -E '^(dist|build|out|node_modules)/'

# Check for new root files
git diff --name-only --diff-filter=A | grep -v '/' | grep -v '^\.'

# Verify documentation updates
git diff --name-only | grep -E '(README|AGENTS|CLAUDE|CONTRIBUTING|SPEC|DESIGN|REVIEW)\.md'
```

**If validation fails:**
1. Fix the issue (update docs, move files, clean structure)
2. Stage the fixes
3. Re-run validation
4. Only then proceed to commit

### 5. Generate Commit Message

**Read project commit conventions** from:
- `CONTRIBUTING.md` - Commit message guidelines
- `.github/PULL_REQUEST_TEMPLATE.md` - PR conventions
- Project documentation (AGENTS.md, README.md)

**Default to Conventional Commits** unless project specifies otherwise:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type

- `feat:` - New feature (triggers minor version bump)
- `fix:` - Bug fix (triggers patch version bump)
- `docs:` - Documentation only
- `style:` - Code style (formatting, no logic change)
- `refactor:` - Code refactoring (no feature/fix)
- `perf:` - Performance improvement
- `test:` - Adding/updating tests
- `build:` - Build system changes
- `ci:` - CI/CD changes
- `chore:` - Maintenance tasks
- `revert:` - Revert previous commit

**Breaking changes:** Add `!` after type/scope: `feat!:` or `feat(api)!:`

#### Scope (optional but recommended)

**For monorepos:**
- Package/app/lib name: `feat(client):`, `fix(server):`, `chore(shared):`
- Component: `feat(auth):`, `fix(api):`, `docs(readme):`

**For single repos:**
- Module/feature: `feat(login):`, `fix(parser):`, `docs(api):`
- File/directory: `refactor(utils):`, `test(handlers):`

#### Subject

- Imperative mood: "add feature" not "added feature"
- No period at end
- Max 50 characters
- Lowercase after type/scope

#### Body (optional)

- Explain **what** and **why**, not **how**
- Wrap at 72 characters
- Separate from subject with blank line
- List changes with `-` or `*`
- **If --fix flag used:** Mention auto-fixed issues

#### Footer (optional)

**Ticket references:**
- Jira: `Refs: PROJ-123`
- GitHub: `Closes #123`, `Fixes #456`
- GitLab: `Closes !123`
- Azure DevOps: `Refs: AB#123`

**Breaking changes:**
```
BREAKING CHANGE: describe what broke and migration path
```

**Co-authors:**
```
Co-authored-by: Name <email@example.com>
```

#### Example Messages

**Simple fix:**
```
fix(parser): handle empty input strings

Prevents crash when parser receives null or empty string.

Fixes #234
```

**Feature with breaking change:**
```
feat(api)!: migrate to REST v2 endpoints

- Remove deprecated v1 endpoints
- Add pagination to all list endpoints
- Update authentication to OAuth2

BREAKING CHANGE: v1 endpoints removed. Migrate to v2 using the
migration guide in docs/migration-v2.md

Refs: PROJ-456
```

**With auto-fix:**
```
feat(client): add user profile page

- Add profile component with avatar upload
- Add profile settings form
- Auto-fixed linting issues (3 errors)

Refs: PROJ-789
```

**Monorepo multi-component:**
```
chore(client): update dependencies
fix(server): resolve memory leak in worker pool
docs(shared): add API documentation
```

### 6. Component-Based Commits (Monorepos)

**When changes span multiple components**, consider breaking into separate commits:

**Benefits:**
- Triggers correct semver bumps per component (Nx, Lerna, Changesets)
- Clearer history and easier rollbacks
- Better CI/CD automation (component-specific builds)

**Strategy:**
1. Group changes by component/package
2. Validate each group independently
3. Commit each group separately with appropriate scope
4. Ensure each commit is atomic and buildable

**Example workflow:**
```bash
# Changes in client/ and server/
git add client/
git commit -m "feat(client): add user profile page"

git add server/
git commit -m "fix(server): resolve auth token expiry"

git add docs/
git commit -m "docs: update API documentation"
```

**When NOT to break commits:**
- Changes are tightly coupled (e.g., API contract change)
- Single logical feature spanning components
- Refactoring that must be atomic

### 7. Stage Changes

- If only tracked files changed, stage all with `git add -A`
- If untracked files exist, ask before staging them
- For component-based commits, stage selectively: `git add <path>`
- **If --fix flag used:** Stage auto-fixed files
- Never stage secrets or generated artifacts; respect `.gitignore`

### 8. Format Code (if applicable)

For adt-cli / Nx monorepos:
- Staged markdown/TS: Husky `lint-staged` runs Prettier on staged files only
- Before push (or after merging GitHub Copilot autofix commits): `bunx nx format:check`
- If it fails: `bunx nx format:write` on reported paths and amend or add follow-up commit

### 9. Commit

```bash
git commit -m "type(scope): subject" -m "body" -m "footer"
```

Or use interactive editor for complex messages:
```bash
git commit
```

### 10. Report

Report the commit hash, type, scope, and summary.

**If --check flag was used:**
- Report CI checks that ran
- Report which checks passed/failed
- Report auto-fixes applied (if --fix flag)

## Flags

### --check

**Run local CI checks before committing:**
- Detects CI configuration (GitHub Actions, GitLab CI, etc.)
- Runs validation steps locally (lint, type-check, test, build)
- Aborts commit if checks fail (unless --fix flag)
- Reports which checks ran and results

**Usage:**
```
/commit --check <subject>
```

### --fix

**Auto-fix issues before committing:**
- Requires --check flag (implied if not provided)
- Attempts to fix linting issues automatically
- Re-runs checks after auto-fix
- Includes fixes in commit
- Mentions fixes in commit message body
- Aborts commit if auto-fix fails

**Usage:**
```
/commit --fix <subject>
/commit --check --fix <subject>
```

## Enforcement

**This workflow is mandatory for all commits.**

Never skip:
- Git tree analysis (understand what changed)
- Pre-commit validation (documentation + structure)
- Commit message format (conventional commits + project rules)
- Ticket references (if project uses issue tracking)
- Local CI checks (if --check flag)

## Related Rules and Commands

- Documentation rules — see `.agents/rules/documentation.md`
- Project structure rules — see `.agents/rules/project-structure.md`
- Command wrapper — see `.agents/commands/commit.md`
- $ci-local — Local CI checks

## Notes

- If nothing to commit, say so and stop
- If changes are large or unclear, summarize and ask for confirmation before committing
- Always validate before staging
- Respect project-specific commit conventions
- For monorepos, consider component-based commits for better semver automation
- Include ticket references when applicable
- Use --check flag to catch CI failures early
- Use --fix flag to auto-fix linting issues