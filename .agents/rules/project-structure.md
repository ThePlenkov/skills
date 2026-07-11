# Project Structure Rule

## Overview
Agents must respect and maintain the established project structure. Every project defines its layout (typically in `AGENTS.md`, `README.md`, or `CONTRIBUTING.md`), and agents must not violate these conventions. This rule enforces structural consistency and prevents organizational drift.

## Core Principles

### 1. Structure is Documented
Every project should have its structure documented. Common locations:
- `AGENTS.md` - Agent-specific structure and rules
- `README.md` - General project layout
- `CONTRIBUTING.md` - Contribution guidelines
- `SPEC.md`, `DESIGN.md`, `REVIEW.md` - Design and review documents

**Before creating any file or directory**, read the project's structure documentation.

### 2. Root Directory is Sacred
The root directory must remain clean and purposeful. Every root-level file or directory must have a clear reason to exist there.

**Allowed in root** (typical patterns):
- Configuration files (`.gitignore`, `package.json`, `tsconfig.json`, etc.)
- Documentation (`README.md`, `LICENSE`, `CHANGELOG.md`)
- Entry points (`index.js`, `main.py`, `Cargo.toml`)
- CI/CD (`.github/`, `.gitlab-ci.yml`)
- Project-specific conventions (`.agents/`, `.memory/` in this repo)

**Not allowed in root**:
- Temporary files (`temp/`, `tmp/`, `scratch/`)
- Build artifacts (`dist/`, `build/`, `out/`)
- Test outputs (`coverage/`, `test-results/`)
- Helper scripts (use `scripts/` or `tools/`)
- Random experiments or POCs (use dedicated directories)

### 3. Follow Monorepo Conventions
If the project is a monorepo, respect its workspace structure:

**Common patterns:**
- `packages/` - Individual packages (npm/yarn workspaces)
- `apps/` - Applications
- `libs/` - Shared libraries
- `tools/` - Build tools and utilities

**Rules:**
- New packages go in the designated workspace directory
- Shared code goes in `libs/` or equivalent
- Don't create cross-workspace dependencies without updating workspace config
- Update workspace manifests (`package.json`, `pnpm-workspace.yaml`, etc.)

### 4. Temporary Files Never Committed
Temporary files must never be committed to git.

**Temporary file patterns:**
- `tmp/`, `temp/`, `.tmp/`, `.temp/`
- `scratch/`, `playground/`
- `*.tmp`, `*.temp`, `*.bak`, `*.swp`
- Build artifacts, logs, cache directories

**Enforcement:**
- Always use `.gitignore` to exclude temporary directories
- Use project-specific temp directories (e.g., `./tmp/` not `/tmp`)
- Clean up temporary files after use
- Never commit files with `.tmp`, `.temp`, `.bak` extensions

### 5. Helper Scripts Have a Home
Helper scripts must be organized, not scattered.

**Standard locations:**
- `scripts/` - Build, deployment, maintenance scripts
- `tools/` - Development tools and utilities
- `.github/scripts/` - CI/CD-specific scripts
- `bin/` - Executable binaries or wrappers

**Rules:**
- Don't put scripts in root unless they're entry points
- Group related scripts in subdirectories
- Document script purpose in README or inline comments
- Make scripts executable (`chmod +x`) if they're meant to be run directly

### 6. Documentation Structure
Documentation must follow project conventions (see `documentation.md` rule).

**Common patterns:**
- `docs/` - Main documentation directory
- `README.md` - Project overview
- `CONTRIBUTING.md` - Contribution guidelines
- Inline documentation (JSDoc, docstrings, etc.)

**Cross-reference**: See `.agents/rules/documentation.md` for full documentation rules.

## Commit Precondition Checklist

Before committing, verify:

### 1. New Files/Directories
- [ ] **Location justified**: File/directory is in the correct location per project structure
- [ ] **Root additions**: If adding to root, there's a documented reason
- [ ] **Monorepo compliance**: New packages/apps are in workspace directories
- [ ] **Documentation updated**: Structure docs reflect new additions

### 2. Temporary Files
- [ ] **No temp files**: No `tmp/`, `temp/`, `*.tmp`, `*.bak` files committed
- [ ] **Gitignore updated**: New temp directories added to `.gitignore`
- [ ] **Build artifacts excluded**: No `dist/`, `build/`, `node_modules/` committed

### 3. Helper Scripts
- [ ] **Proper location**: Scripts are in `scripts/`, `tools/`, or equivalent
- [ ] **Not in root**: No loose scripts in root directory
- [ ] **Documented**: Script purpose is clear (README or inline)
- [ ] **Executable**: Scripts have proper permissions if needed

### 4. Structure Consistency
- [ ] **Follows conventions**: New additions follow existing patterns
- [ ] **No drift**: Structure hasn't diverged from documentation
- [ ] **Cross-references valid**: Links between files still work

## Examples by Project Type

### Skills Repository (This Repo)

**Documented structure** (from `AGENTS.md`):
```
.agents/
  agents/     - Role prompts
  skills/     - Skills (each in own folder)
  commands/   - Command definitions
  rules/      - Agent behavior rules
.memory/      - Transient memory files
scripts/      - Helper scripts
```

**Rules:**
- No new top-level folders under `.agents/` besides `agents/`, `skills/`, `commands/`, `rules/`
- Transient data (memory, backlog, plans) lives outside `.agents/`
- Skills go in `.agents/skills/<skill-name>/`
- Helper scripts go in `scripts/`

**Violations:**
- ❌ Creating `.agents/temp/`
- ❌ Adding `my-script.sh` to root
- ❌ Creating `.agents/memory/` (should be `.memory/`)
- ❌ Adding `test-output/` to root

### Monorepo Example

**Documented structure**:
```
packages/
  package-a/
  package-b/
apps/
  app-1/
  app-2/
libs/
  shared/
tools/
  build-tools/
```

**Rules:**
- New packages go in `packages/`
- New apps go in `apps/`
- Shared code goes in `libs/`
- Build tools go in `tools/`

**Violations:**
- ❌ Creating `my-package/` in root
- ❌ Adding shared code to `packages/package-a/shared/`
- ❌ Creating `scripts/` when `tools/` exists

### Library Example

**Documented structure**:
```
src/          - Source code
tests/        - Test files
docs/         - Documentation
examples/     - Usage examples
scripts/      - Build/release scripts
```

**Rules:**
- Source code in `src/`
- Tests mirror `src/` structure in `tests/`
- Examples in `examples/`
- No source code in root

**Violations:**
- ❌ Adding `utils.js` to root
- ❌ Creating `my-tests/` directory
- ❌ Adding `example.js` to root

## Detection Strategy

### Before Creating Files

1. **Read structure documentation**:
   ```bash
   # Check for structure docs
   cat AGENTS.md README.md CONTRIBUTING.md | grep -i "layout\|structure\|organization"
   ```

2. **Analyze existing structure**:
   ```bash
   # List root directories
   ls -d */
   
   # Check for patterns
   find . -maxdepth 2 -type d
   ```

3. **Check for conventions**:
   - Is there a `scripts/` directory? Use it.
   - Is there a `tools/` directory? Use it.
   - Is there a `docs/` directory? Use it.
   - Is this a monorepo? Check workspace config.

### Before Committing

1. **Review changed files**:
   ```bash
   git status
   git diff --name-only --cached
   ```

2. **Check for violations**:
   ```bash
   # Check for temp files
   git diff --cached --name-only | grep -E '\.(tmp|temp|bak|swp)$'
   
   # Check for root additions
   git diff --cached --name-only | grep -v '/' | grep -v '^\..*'
   
   # Check for build artifacts
   git diff --cached --name-only | grep -E '^(dist|build|out|node_modules)/'
   ```

3. **Verify structure docs are updated**:
   ```bash
   # If structure changed, check if docs updated
   git diff --cached AGENTS.md README.md CONTRIBUTING.md
   ```

## Integration with Other Rules

This rule works with:
- **documentation.md**: Structure changes require documentation updates
- **agent-memory.md**: Remember project-specific structure patterns
- **retrospect**: Capture structure violations for prevention

## Anti-Patterns

- Creating files/directories without checking project structure
- Adding temporary files to git
- Scattering helper scripts across the project
- Creating new root-level directories without justification
- Ignoring monorepo workspace conventions
- Committing build artifacts or cache directories
- Creating parallel structures (e.g., both `scripts/` and `tools/`)

## Enforcement

**Before any file creation:**
1. Read project structure documentation
2. Identify correct location for new file/directory
3. Verify location follows conventions
4. Update structure documentation if needed

**Before any commit:**
1. Run `git status` to see all changes
2. Verify no temporary files are staged
3. Verify no build artifacts are staged
4. Verify new files are in correct locations
5. Verify structure documentation is updated
6. Include structure rationale in commit message if adding new directories

**Commit message should mention structure changes:**
```
feat: add new helper script for deployment

- Add scripts/deploy.sh for automated deployment
- Update scripts/README.md with usage instructions
- Follows project structure convention (scripts/ directory)
```

## Project-Specific Patterns

### Skills Repository
- `.agents/` is static (skills, rules, commands, agents)
- Transient data outside `.agents/` (`.memory/`, `.backlog/`, etc.)
- Helper scripts in `scripts/`
- No new top-level folders without updating `AGENTS.md`

### Monorepos
- Respect workspace boundaries
- Update workspace manifests when adding packages
- Shared code in designated `libs/` or `shared/` directory
- Tools and scripts in `tools/` or root `scripts/`

### Libraries
- Source in `src/`, tests in `tests/`
- Examples in `examples/` or `docs/examples/`
- No source code in root
- Build scripts in `scripts/` or `tools/`

## Related Rules

- `documentation.md`: Documentation must reflect structure
- `agent-memory.md`: Remember project-specific patterns
- `retrospect`: Learn from structure violations

## Validation Script Example

```bash
#!/bin/bash
# scripts/validate-structure.sh

# Check for temp files
if git diff --cached --name-only | grep -E '\.(tmp|temp|bak|swp)$'; then
  echo "Error: Temporary files detected"
  exit 1
fi

# Check for build artifacts
if git diff --cached --name-only | grep -E '^(dist|build|out|node_modules)/'; then
  echo "Error: Build artifacts detected"
  exit 1
fi

# Check for new root files (excluding known patterns)
new_root_files=$(git diff --cached --name-only --diff-filter=A | grep -v '/' | grep -v '^\.' | grep -v '^README' | grep -v '^LICENSE' | grep -v '^CHANGELOG')
if [ -n "$new_root_files" ]; then
  echo "Warning: New root-level files detected:"
  echo "$new_root_files"
  echo "Ensure these are justified and documented"
fi

echo "Structure validation passed"
```
