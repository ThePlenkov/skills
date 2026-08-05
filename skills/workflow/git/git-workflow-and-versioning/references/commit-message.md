# Commit Message Reference

Default to **Conventional Commits** unless the project specifies otherwise. Detect project conventions from `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `AGENTS.md`, or `README.md`.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Type

| Type | Semver |
|------|--------|
| `feat:` | minor bump |
| `fix:` | patch bump |
| `docs:` | none |
| `style:` | none |
| `refactor:` | none |
| `perf:` | none |
| `test:` | none |
| `build:` | none |
| `ci:` | none |
| `chore:` | none |
| `revert:` | none |

Breaking change: add `!` after type/scope, e.g. `feat!:` or `feat(api)!:`.

## Scope

- **Monorepos**: package/app/lib name (`feat(client):`, `fix(server):`) or component (`feat(auth):`).
- **Single repos**: module/feature (`feat(login):`, `fix(parser):`) or file/directory (`refactor(utils):`).

## Subject rules

- Imperative mood: "add feature", never "added feature".
- No trailing period.
- Max 50 chars.
- Lowercase after type/scope.

## Body

- Explain **what** and **why**, not **how**.
- Wrap at 72 characters.
- Blank line between subject and body.
- Bullet list with `-` or `*`.
- If `--fix` was used: mention auto-fixed issues.

## Footer

- Jira: `Refs: PROJ-123`
- GitHub: `Closes #123`, `Fixes #456`
- GitLab: `Closes !123`
- Azure DevOps: `Refs: AB#123`
- Breaking change: `BREAKING CHANGE: <what broke and migration path>`
- Co-author: `Co-authored-by: Name <email@example.com>`

## Examples

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

## Component-based commits (monorepos)

When changes span multiple components, break into separate commits to trigger correct semver bumps per component (Nx, Lerna, Changesets) and enable easier rollbacks.

```bash
git add client/
git commit -m "feat(client): add user profile page"
git add server/
git commit -m "fix(server): resolve auth token expiry"
git add docs/
git commit -m "docs: update API documentation"
```

**Don't break** when changes are tightly coupled (e.g. API contract change), span a single logical feature, or are an atomic refactor.
