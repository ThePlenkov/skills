---
name: git-commit
description: Create git commits with validation of documentation and project structure. Analyzes git tree to determine what changed, generates conventional commit messages respecting project rules, and optionally breaks commits by component for semver automation. Supports --check flag to run CI checks locally and --fix flag to auto-fix issues.
source: ThePlenkov/skills
---

# Git Commit

Validate changes, generate a conventional commit message, and commit atomically. Optional `--check` runs CI locally; `--fix` auto-fixes linting issues.

## Workflow

### 1. Analyze the git tree

```bash
git status -sb
git diff --stat
git diff --name-only
```

Categorize changes: modified files by directory/component, new files + purpose, deleted files + impact, config changes, doc updates. For monorepos, detect components via `package.json` / `pnpm-workspace.yaml` / `nx.json` and group changes by package/app/lib.

### 2. Local CI checks (`--check` or `--fix`)

If `--check` or `--fix`: invoke `$skill{ci-local}`. On failure, abort (unless `--fix`). Otherwise proceed.

### 3. Auto-fix (`--fix`)

Attempt linting auto-fix per `$skill{ci-local}`. Re-run checks; on success include fixes in the commit and mention them in the body. On failure, abort.

### 4. Pre-commit validation

Before staging, validate changes against project rules:

- **Documentation updates** — moved/renamed/deleted/new files have references updated; API/feature/breaking changes touch docs; CI/CD and env var changes are documented; structural changes update README/AGENTS.md layout.
- **Project structure** — new dirs at root justified; no temp files; helper scripts in `scripts/` or `tools/`; existing patterns followed.

Full checklists and detection commands: [references/pre-commit-validation.md](references/pre-commit-validation.md).

If validation fails: fix the issue, stage the fix, re-run validation, then commit.

### 5. Generate the commit message

Default to Conventional Commits. Read project conventions from `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `AGENTS.md`, `README.md`.

Format, type/scope/subject/body/footer rules, examples: [references/commit-message.md](references/commit-message.md).

### 6. Component-based commits (monorepos)

If changes span multiple components, consider breaking into separate commits so semver automation + CI run per component. Group by package, validate each, commit atomically. Skip when changes are tightly coupled (e.g. API contract changes) or the refactor must be atomic.

### 7. Stage changes

- Only tracked files changed → `git add -A`.
- Untracked files exist → ask before staging.
- Component-based commits → stage selectively: `git add <path>`.
- `--fix` → stage auto-fixed files too.
- Never stage secrets or generated artifacts. Respect `.gitignore`.

### 8. Format code (if applicable)

For adt-cli / Nx monorepos:

- Staged markdown/TS: Husky `lint-staged` runs Prettier on staged files only.
- Before push (or after merging autofix): `bunx nx format:check`.
- If it fails: `bunx nx format:write` and amend or add a follow-up commit.

### 9. Commit

```bash
git commit -m "type(scope): subject" -m "body" -m "footer"
# or interactive editor
git commit
```

### 10. Report

Report the commit hash, type, scope, summary. If `--check` was used, report which CI checks ran / passed / failed / auto-fixed.

## Flags

- `--check` — run `$skill{ci-local}` first; abort on failure unless `--fix` is set.
- `--fix` — implies `--check`; runs `$skill{ci-local}`, auto-fixes linting, includes fixes in commit; mentions them in body.

## Enforcement

Never skip: tree analysis, pre-commit validation, conventional-commit format, ticket references, CI checks when `--check` was requested.

## Integration

- `$skill{ci-local}` — invoked for `--check` / `--fix`.
- `.agents/rules/documentation.md`, `.agents/rules/project-structure.md` — referenced by validation.
- `.agents/commands/commit.md` — command wrapper.

## Notes

- "Nothing to commit" → say so, stop.
- Large or unclear changes → summarize and ask before committing.
- Always validate before staging.
- Respect project-specific commit conventions.
- For monorepos, prefer component-based commits for better semver automation.
- Include ticket references when applicable.
