---
description: Commit changes with validation of documentation and project structure
argument-hint: <subject>
---

Commit changes after analyzing git tree, validating documentation updates and project structure compliance.

**This command wraps the `git-commit` skill workflow.**

## Usage

```
/commit <subject>
```

**Examples:**
```
/commit user authentication
/commit API refactoring
/commit documentation updates
/commit memory migration
```

The agent will:
1. **Analyze git tree** to determine what changed
2. **Validate changes** against documentation and structure rules
3. **Generate commit message** following conventional commits and project rules
4. **Stage appropriate files** (respecting .gitignore)
5. **Create commit(s)** - may break into component-based commits for monorepos
6. **Report commit hash(es)** and summary

## Commit Message Generation

The agent generates commit messages following:
- **Conventional Commits** format (unless project specifies otherwise)
- **Project-specific rules** from CONTRIBUTING.md, AGENTS.md, README.md
- **Ticket references** (Jira, GitHub, GitLab, Azure DevOps) when applicable
- **Component scopes** for monorepos (triggers semver automation)

**Message format:**
```
<type>(<scope>): <subject>

<body>

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

See `.agents/skills/git-commit/SKILL.md` for the complete workflow including:

- Git tree analysis and change categorization
- Pre-commit validation checklist (documentation + structure)
- Conventional commits format and examples
- Component-based commit strategy
- Ticket reference patterns
- Code formatting (if applicable)

## Precondition Rules

This command enforces:
- `.agents/rules/documentation.md` - Documentation must be updated
- `.agents/rules/project-structure.md` - Structure must be maintained

**Never skip validation.** If validation fails, fix issues before committing.

## Related

- `.agents/skills/git-commit/SKILL.md` - Full workflow implementation
- `.agents/rules/documentation.md` - Documentation validation rules
- `.agents/rules/project-structure.md` - Structure validation rules
