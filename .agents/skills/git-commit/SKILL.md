---
name: git-commit
description: Create git commits with validation of documentation and project structure. Analyzes git tree to determine what changed, generates conventional commit messages respecting project rules, and optionally breaks commits by component for semver automation.
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

### 2. Pre-Commit Validation

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

### 3. Generate Commit Message

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

**Documentation update:**
```
docs: add commit command and refactor git-commit skill

- Add comprehensive validation workflow
- Include conventional commits guidelines
- Document component-based commit strategy

Refs: PROJ-789
```

**Monorepo multi-component:**
```
chore(client): update dependencies
fix(server): resolve memory leak in worker pool
docs(shared): add API documentation
```

### 4. Component-Based Commits (Monorepos)

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

### 5. Stage Changes

- If only tracked files changed, stage all with `git add -A`
- If untracked files exist, ask before staging them
- For component-based commits, stage selectively: `git add <path>`
- Never stage secrets or generated artifacts; respect `.gitignore`

### 6. Format Code (if applicable)

For adt-cli / Nx monorepos:
- Staged markdown/TS: Husky `lint-staged` runs Prettier on staged files only
- Before push (or after merging GitHub Copilot autofix commits): `bunx nx format:check`
- If it fails: `bunx nx format:write` on reported paths and amend or add follow-up commit

### 7. Commit

```bash
git commit -m "type(scope): subject" -m "body" -m "footer"
```

Or use interactive editor for complex messages:
```bash
git commit
```

### 8. Report

Report the commit hash, type, scope, and summary.

## Enforcement

**This workflow is mandatory for all commits.**

Never skip:
- Git tree analysis (understand what changed)
- Pre-commit validation (documentation + structure)
- Commit message format (conventional commits + project rules)
- Ticket references (if project uses issue tracking)

## Related Rules and Commands

- `.agents/rules/documentation.md` - Full documentation rule
- `.agents/rules/project-structure.md` - Full project structure rule
- `.agents/commands/commit.md` - Command wrapper for this skill

## Notes

- If nothing to commit, say so and stop
- If changes are large or unclear, summarize and ask for confirmation before committing
- Always validate before staging
- Respect project-specific commit conventions
- For monorepos, consider component-based commits for better semver automation
- Include ticket references when applicable
