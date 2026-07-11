# Documentation Rule

## Overview
Before any commit, agents must review changes and update all affected documentation to maintain consistency. Documentation includes not just markdown files, but any file that describes system behavior, structure, or usage.

## What Counts as Documentation

Documentation varies by project, but commonly includes:

### Explicit Documentation
- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`
- `docs/` directory contents
- `AGENTS.md`, `CLAUDE.md` (agent-specific)
- `SPEC.md`, `DESIGN.md`, `REVIEW.md` (design and review documents)
- API documentation (OpenAPI/Swagger specs, JSDoc, etc.)
- Architecture Decision Records (ADRs)
- Inline code comments describing public APIs

### Implicit Documentation
- Configuration files that describe structure (e.g., `tsconfig.json`, `.eslintrc`)
- Package manifests (`package.json`, `pyproject.toml`, `Cargo.toml`)
- CI/CD workflow files (`.github/workflows/*.yml`)
- Schema files (JSON Schema, GraphQL schemas, database migrations)
- Example files and templates
- Test files that serve as usage examples

### Project-Specific Documentation
Each project may have unique documentation patterns:
- Skills repository: `.agents/skills/README.md` (skill index)
- Monorepos: workspace configuration, dependency graphs
- Libraries: usage examples, migration guides
- APIs: endpoint documentation, request/response examples

## Commit Precondition Checklist

Before committing, review changes and check:

### 1. File Operations
- [ ] **Moved files**: Update all references (imports, links, paths)
- [ ] **Renamed files**: Update references in docs, configs, and code
- [ ] **Deleted files**: Remove from indexes, update dependent docs
- [ ] **New files**: Add to relevant indexes or README sections

### 2. Code Changes
- [ ] **Refactoring**: Update architecture docs, diagrams, examples
- [ ] **API changes**: Update API docs, OpenAPI specs, usage examples
- [ ] **New features**: Add to README, update feature lists
- [ ] **Breaking changes**: Update migration guides, CHANGELOG

### 3. Configuration Changes
- [ ] **Build config**: Update setup instructions
- [ ] **Dependencies**: Update installation docs, version requirements
- [ ] **Environment variables**: Update `.env.example`, setup guides
- [ ] **CI/CD**: Update workflow documentation

### 4. Structural Changes
- [ ] **Directory reorganization**: Update layout sections in README/AGENTS.md
- [ ] **New directories**: Document purpose in parent README or AGENTS.md
- [ ] **Removed directories**: Update layout documentation

## Examples by Change Type

### Example 1: Moving a File

**Change**: Move `.agents/memory/` → `.memory/`

**Documentation Impact**:
- Update `AGENTS.md` layout section
- Update `README.md` layout section
- Update all skills that reference the path
- Update `.gitignore` if needed
- Update any scripts that use the path

### Example 2: Renaming a Skill

**Change**: Rename `git-commit` skill to `conventional-commit`

**Documentation Impact**:
- Update `.agents/skills/README.md` index
- Update any skills that reference it
- Update any agent prompts that mention it
- Update installation examples in README
- Search for old name in all markdown files

### Example 3: API Refactoring

**Change**: Split `UserService` into `UserAuthService` and `UserProfileService`

**Documentation Impact**:
- Update architecture diagrams
- Update API documentation
- Update usage examples
- Update test examples
- Update inline JSDoc/comments

### Example 4: Adding a New Directory

**Change**: Create `.agents/commands/` directory

**Documentation Impact**:
- Add to `AGENTS.md` layout section
- Add to `README.md` layout section
- Add to `CLAUDE.md` layout section
- Document purpose and usage pattern
- Update repository rules if needed

### Example 5: Configuration Change

**Change**: Add new environment variable `MEMORY_BACKEND`

**Documentation Impact**:
- Update `.env.example`
- Update setup/installation docs
- Update configuration reference
- Add to troubleshooting if relevant

## Detection Strategy

### Automated Checks
Use these patterns to detect documentation drift:

```bash
# Find broken markdown links
grep -r '\[.*\](\.\.*/.*\.md)' . | while read line; do
  # Extract and verify each link exists
done

# Find references to moved/renamed files
git diff --name-status HEAD~1 | grep '^R' | while read status old new; do
  # Search for references to old path
  rg "$old" --type md
done

# Find outdated imports after refactoring
git diff HEAD~1 --name-only | grep '\.ts$' | while read file; do
  # Check if any docs reference old exports
done
```

### Manual Review
Before committing, ask:
1. "What files did I change?"
2. "What documentation describes these files?"
3. "What documentation references these files?"
4. "What examples use these files?"
5. "What configuration depends on these files?"

## Integration with Other Rules

This rule complements:
- **agent-memory.md**: Document learnings about documentation patterns
- **retrospect**: Capture documentation mistakes for prevention
- **drill-troubleshooting.md**: Document troubleshooting steps

## Anti-Patterns

- Committing code changes without checking documentation
- Updating only explicit docs (README) but not implicit docs (configs)
- Assuming documentation is "just markdown files"
- Forgetting to update examples after API changes
- Not searching for references to renamed/moved files
- Updating documentation in a separate commit (do it atomically)

## Enforcement

**Before calling `git commit`:**
1. Run `git status` to see all changed files
2. For each changed file, identify affected documentation
3. Update all affected documentation in the same commit
4. Verify no broken references remain
5. Include documentation updates in commit message

**Commit message should mention documentation updates:**
```
refactor: migrate memory storage from .agents/memory to .memory

- Move .agents/memory/ directory to .memory/
- Update all references in skills, rules, commands
- Update AGENTS.md, CLAUDE.md, README.md layout sections
- Add .memory/ to .gitignore

Files updated:
- [list of updated documentation files]
```

## Project-Specific Patterns

### Skills Repository
- Always update `.agents/skills/README.md` when adding/removing skills
- Update `AGENTS.md` when changing repository structure
- Update skill references when renaming or moving skills
- Keep layout sections synchronized across AGENTS.md, CLAUDE.md, README.md

### Monorepos
- Update workspace documentation when adding/removing packages
- Update dependency graphs when changing inter-package dependencies
- Update build documentation when changing build configuration

### Libraries
- Update API reference when changing public APIs
- Update migration guides for breaking changes
- Update usage examples when changing recommended patterns

## Related Skills

- `retrospect`: Capture documentation mistakes
- `memory`: Remember project-specific documentation patterns
- `git-commit`: Structured commit messages that include doc updates
