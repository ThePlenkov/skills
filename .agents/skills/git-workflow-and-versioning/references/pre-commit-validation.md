# Pre-Commit Validation Rules

<!-- os-independence-exempt: reference bash detection recipes; run in Git Bash / WSL on Windows -->

Detailed checklists referenced by the operational commit workflow. Read `.agents/rules/documentation.md` and `.agents/rules/project-structure.md` for full project rules.

## Documentation updates

**File operations:**

- [ ] Moved files → all references updated (imports, links, paths).
- [ ] Renamed files → references updated in docs, configs, code.
- [ ] Deleted files → removed from indexes, dependent docs updated.
- [ ] New files → added to relevant indexes or README sections.

**Code changes:**

- [ ] Refactoring → architecture docs, diagrams, examples updated.
- [ ] API changes → API docs, OpenAPI specs, usage examples updated.
- [ ] New features → added to README, feature lists updated.
- [ ] Breaking changes → migration guides, CHANGELOG updated.

**Configuration changes:**

- [ ] Build config → setup instructions updated.
- [ ] Dependencies → installation docs, version requirements updated.
- [ ] Environment variables → `.env.example`, setup guides updated.
- [ ] CI/CD → workflow documentation updated.

**Structural changes:**

- [ ] Directory reorganization → layout sections in README/AGENTS.md updated.
- [ ] New directories → purpose documented in parent README or AGENTS.md.
- [ ] Removed directories → layout documentation updated.

## Project structure compliance

**New files / directories:**

- [ ] Location justified per project structure documentation.
- [ ] Root additions have documented reason.
- [ ] Monorepo compliance (packages/apps in workspace directories).
- [ ] Structure documentation updated for new additions.

**Temporary files:**

- [ ] No `tmp/`, `temp/`, `*.tmp`, `*.bak` files committed.
- [ ] `.gitignore` updated for new temp directories.
- [ ] Build artifacts excluded (`dist/`, `build/`, `node_modules/`).

**Helper scripts:**

- [ ] Scripts in proper location (`scripts/`, `tools/`, or equivalent).
- [ ] No loose scripts in root directory.
- [ ] Script purpose documented (README or inline).
- [ ] Executable permissions set if needed.

**Structure consistency:**

- [ ] New additions follow existing patterns.
- [ ] No structural drift from documentation.
- [ ] Cross-references between files still valid.

## Detection commands

```bash
# Temp files
git diff --name-only | grep -E '\.(tmp|temp|bak|swp)$'

# Build artifacts
git diff --name-only | grep -E '^(dist|build|out|node_modules)/'

# New root files
git diff --name-only --diff-filter=A | grep -v '/' | grep -v '^\.'

# Documentation updates
git diff --name-only | grep -E '(README|AGENTS|CLAUDE|CONTRIBUTING|SPEC|DESIGN|REVIEW)\.md'
```

If validation fails: fix (update docs / move files / clean structure), re-run validation, then commit.
