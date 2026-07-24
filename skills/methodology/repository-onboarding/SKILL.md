---
name: repository-onboarding
description: Use when an agent or developer must quickly understand a previously unknown repository — its purpose, layout, build/test/lint conventions, dependency graph, and where to make changes. Applies on first contact with a codebase, after a long hiatus, or when handed a new project. Pairs with $skill{investigate-first} (narrow code area) and $skill{architecture-review} (deep structural critique).
allowed-tools: read, grep, glob, exec
argument-hint: <repository path or URL, optional focus area>
tier: 2
triggers:
  - user
  - model
source: theplenkov-ai/skills
---

# Repository Onboarding

Goal: reach a defensible mental model of a repository fast enough to make a safe first change.

Use this skill when:

- first contact with a previously unknown repo
- returning after a long absence
- delegating to a subagent that needs context
- scoping a PR, refactor, or migration that touches many areas
- handed a project with no orientation briefing

Do not use this skill when:

- only one file or function is unclear (use $skill{investigate-first})
- the question is "is this design good?" (use $skill{architecture-review})
- a failure is already occurring (use $skill{debugging})

## Onboarding Procedure

### 1. Capture the elevator pitch

Read, in order of priority:

1. `README.md`, `README.rst`, or `README`
2. `CONTRIBUTING.md`, `DEVELOPING.md`, `HACKING.md`
3. `docs/`, `documentation/`, `wiki/`
4. Top-level metadata: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`, `Gemfile`, `*.csproj`
5. LICENSE, CODEOWNERS, `.github/CODEOWNERS`

Extract:

- one-sentence purpose
- primary users / use cases
- non-goals (often missing — infer from tests, comments, and recent issues)
- the dominant framework(s)

If the README and metadata disagree, stop and report the conflict.

### 2. Map the directory layout

One pass over the tree:

- identify `src/`, `lib/`, `app/`, `cmd/`, `pkg/`, `internal/`, `packages/`, `services/`
- identify entrypoints: `bin/`, `cmd/`, `main.*`, `index.*`, `app.*`, `server.*`, `worker.*`
- identify tests: `tests/`, `test/`, `__tests__/`, `spec/`, `*_test.*`, `*.test.*`
- identify config: `config/`, `.env*`, `*.config.*`, `helm/`, `terraform/`, `k8s/`
- identify generated/vendor: `dist/`, `build/`, `vendor/`, `node_modules/`, `target/`

Record the shape in a one-screen map. Do not paste the raw tree.

### 3. Detect and validate the build system

Detect:

- package manager: lockfile presence (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `Cargo.lock`, `go.sum`, `poetry.lock`, `Pipfile.lock`)
- test runner: scripts in `package.json`, `[tool.pytest]`, `go test`, `cargo test`
- lint / format: `eslint`, `prettier`, `ruff`, `black`, `clippy`, `gofmt`, `golangci-lint`
- typecheck: `tsc`, `mypy`, `pyright`
- CI: `.github/workflows/`, `.gitlab-ci.yml`, `circle/`, `.circleci/`

Validate before trusting:

- run `install` (or its equivalent) on a clean checkout
- run the smallest test command
- run the lint command
- run the typecheck command

Record exact commands. If anything fails on a clean tree, flag it as a known onboarding risk.

### 4. Read the dependency graph

Quickly classify dependencies by role, not by version:

- core runtime (framework, HTTP, ORM)
- utilities (logging, validation, dates)
- dev-time (test, lint, format, typecheck)
- generated (codegen, protobuf)
- optional integrations (feature flags, plug-ins)

Skip detailed version analysis. Note only:

- lockfile freshness vs declared version ranges
- explicit security advisories in `SECURITY.md` or `.github/dependabot.yml`
- vendored or pinned dependencies (differ from transitive)

### 5. Infer architecture from layout

Look for shape signals:

- monolith vs multiple services: count entrypoints and `Dockerfile`s
- layered: presence of `controllers/`, `services/`, `repositories/`, `models/`
- hexagonal / ports-and-adapters: presence of `ports/`, `adapters/`, `domain/`
- monorepo: presence of `packages/`, `apps/`, `workspaces/`
- generated boundaries: `*.pb.go`, `*.gen.*`, `openapi/`

Do not write an architecture review — only state the inferred shape in 2-3 sentences. Defer deeper critique to $skill{architecture-review}.

### 6. Learn the navigation shortcuts

Before searching blindly, identify the project's indexing signals:

- language `import` conventions (relative vs absolute, paths)
- naming conventions: `*Controller`, `*Service`, `*Repository`, `*.test.*`, `*_test.*`
- public API surfaces: `index.ts`, `__init__.py`, `mod.rs`, `mod.go`
- generated or vendored folders to exclude from searches

Use `grep`/`glob` with these signals to locate anything fast:

- class/function by exact name
- symbol used across files
- error string from logs/tests

### 7. Identify the test conventions

Read 2-3 representative tests and record:

- naming pattern (`foo_test.py` vs `test_foo.py`)
- setup/teardown conventions
- mocking style (mocks vs fakes vs real services)
- fixtures location (`tests/fixtures/`, `conftest.py`, `__fixtures__/`)
- the line between unit and integration tests
- how to run a single test

Match the existing style before writing the first test in this repo.

### 8. Capture the contribution rules

From `CONTRIBUTING.md`, PR templates, and recent merged PRs:

- branch naming
- commit message format
- required checks
- review expectations
- ownership map (CODEOWNERS)

### 9. Record an onboarding brief

Produce a single-page brief containing:

- purpose / non-goals
- layout map (one screen)
- install / build / test / lint / typecheck commands
- directory responsibilities (top 5-10 dirs)
- test conventions
- contribution rules
- known risks / sharp edges
- first safe edit suggestion (optional)

This brief is the input to any future $skill{investigate-first}, $skill{debugging}, or $skill{refactoring} session.

## What NOT to do

- Do not read the entire codebase. Sample.
- Do not run heavy CI on first contact. Use the smallest commands.
- Do not propose refactors during onboarding.
- Do not skip the validation step. Untested assumptions become wasted PRs.
- Do not trust a single README — cross-check with at least one source of truth (lockfile, CI, top-of-tree metadata).

## Required output

Onboarding brief covering:

- Repository purpose and non-goals
- Top-level layout and responsibilities
- Build, test, lint, typecheck commands (verified)
- Dependency roles (not versions)
- Inferred architecture shape (2-3 sentences)
- Test conventions
- Contribution rules and CODEOWNERS
- Known sharp edges and risks
- Recommended first safe edit (optional)

## Stop conditions

Stop and report blocked if:

- install or test commands fail on a clean clone for non-obvious reasons
- the README and the actual layout disagree and the conflict cannot be resolved
- access to required repositories, registries, or credentials is missing
- the codebase is large enough that a full onboarding exceeds the budget — split by subdirectory or service

## Related skills

- $skill{investigate-first} — narrow-area investigation after the brief is done.
- $skill{architecture-review} — turn the brief into a structural critique.
- $skill{debugging} — apply when a failure shows up during onboarding checks.
- $skill{codehome} — apply if onboarding reveals misplaced code.
