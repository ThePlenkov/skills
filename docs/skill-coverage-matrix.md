# Skill Coverage Matrix

Auto-generated from skill frontmatter. Run `npx tsx scripts/generate-coverage-matrix.ts` to regenerate.

## By category

| Category | Description | Skills |
| --- | --- | --- |
| `agents` | Framework management and agent configuration | `claude-skills`, `dotagents` |
| `behavior` | Evidence, code quality, and critical thinking | `critical-thinking`, `minimalist` |
| `coaching` | User guidance and focus support | `adhd`, `idea-refine`, `interview-me` |
| `code-review` | PR/MR review and remediation | `act`, `github-fix-main`, `github-pr-review`, `triage-issue`, `two-axis-review` |
| `engineering` | Cross-cutting engineering practices (API/UI design, performance, security) | `api-and-interface-design`, `architecture-review`, `bootstrap-ts-repo`, `frontend-ui-engineering`, `nodejs`, `performance-optimization`, `prototype`, `security-and-hardening`, `typescript` |
| `experimentation` | Sandboxed experimentation | `sandboxed` |
| `foundation` | Always-on behavioral primitives and activation tiers | `persistent-memory`, `skill-tiers`, `token-rationalism` |
| `integrations` | External platform connectors | `bootstrap-gh-self-hosted-runner`, `codacy`, `codescene`, `gitlab-ci-local`, `glean`, `sourcegraph` |
| `methodology` | Development methodology | `code-review-and-quality`, `code-simplification`, `codehome`, `context-engineering`, `dep-cost`, `doubt-driven-development`, `external-tools`, `incremental-implementation`, `investigate-first`, `loop-programming`, `minimal-root-cause`, `modern-stack`, `observability-and-instrumentation`, `one-shot-patch`, `refactoring`, `repository-onboarding`, `reuse-first`, `review-methodology`, `source-driven-development`, `spec-driven-development`, `test-driven-development` |
| `orchestration` | Agent coordination, isolation, context management, and skill discovery | `handoff`, `save-session`, `subagent-capsule`, `unwind`, `using-agent-skills` |
| `research` | Codebase analysis and documentation tools | `deepwiki`, `external-research` |
| `safety` | Destructive operation protection and recovery | `drill`, `safeguard`, `salvage` |
| `self-learning` | Retrospective learning and skill-improvement feedback | `retrospect`, `skill-feedback` |
| `tools` | Agent development utilities | `docker-agent-config`, `npm-publish`, `sarif-to-annotations`, `skillmaker`, `skills-cli`, `tsdown`, `writing-great-skills` |
| `troubleshooting` | Scoped descent, debugging, and performance investigation | `debugging`, `performance-investigation` |
| `verification` | Runtime proof and evidence-backed claims | `evidence`, `evidence-lite` |
| `workflow` | Development workflow | `backlog`, `ci-cd-and-automation`, `ci-local`, `e2e`, `git-commit`, `git-push`, `git-reset`, `git-workflow-and-versioning`, `harvest`, `resolving-merge-conflicts`, `shadow-fork`, `shared-plan` |

## Skill catalog

| Skill | Category | Tier | Triggers | Conflicts with | Depends on |
| --- | --- | --- | --- | --- | --- |
| `claude-skills` | `agents` | 2 | user, model | — | — |
| `dotagents` | `agents` | 2 | user, model | — | — |
| `critical-thinking` | `behavior` | 2 | user, model | — | — |
| `minimalist` | `behavior` | 2 | user, model | — | — |
| `adhd` | `coaching` | 2 | user, model | — | — |
| `idea-refine` | `coaching` | 2 | user, model | — | — |
| `interview-me` | `coaching` | 2 | user, model | — | — |
| `act` | `code-review` | 2 | user, model | `$skill{github-pr-review}`, `$skill{code-review-and-quality}` | — |
| `github-fix-main` | `code-review` | 2 | user, model | — | — |
| `github-pr-review` | `code-review` | 2 | user, model | `$skill{code-review-and-quality}` | — |
| `triage-issue` | `code-review` | 2 | user, model | — | — |
| `two-axis-review` | `code-review` | 2 | user, model | `$skill{github-pr-review}`, `$skill{code-review-and-quality}` | — |
| `api-and-interface-design` | `engineering` | 2 | user, model | — | — |
| `architecture-review` | `engineering` | 2 | user, model | — | — |
| `bootstrap-ts-repo` | `engineering` | 2 | user, model | — | — |
| `frontend-ui-engineering` | `engineering` | 2 | user, model | — | — |
| `nodejs` | `engineering` | 2 | user, model | — | — |
| `performance-optimization` | `engineering` | 2 | user, model | — | — |
| `prototype` | `engineering` | 2 | user, model | — | — |
| `security-and-hardening` | `engineering` | 2 | user, model | — | — |
| `typescript` | `engineering` | 2 | user, model | — | — |
| `sandboxed` | `experimentation` | 2 | user, model | — | — |
| `persistent-memory` | `foundation` | 1 | user | — | — |
| `skill-tiers` | `foundation` | 2 | user, model | — | — |
| `token-rationalism` | `foundation` | 0 | always | — | — |
| `bootstrap-gh-self-hosted-runner` | `integrations` | 2 | user | — | — |
| `codacy` | `integrations` | 2 | user, model | — | — |
| `codescene` | `integrations` | 2 | user, model | — | — |
| `gitlab-ci-local` | `integrations` | 2 | user, model | — | — |
| `glean` | `integrations` | 2 | user, model | — | — |
| `sourcegraph` | `integrations` | 2 | user, model | — | `$skill{external-research}` |
| `code-review-and-quality` | `methodology` | 2 | user, model | `$skill{github-pr-review}` | — |
| `code-simplification` | `methodology` | 2 | user, model | — | — |
| `codehome` | `methodology` | 2 | user | — | — |
| `context-engineering` | `methodology` | 2 | user, model | — | — |
| `dep-cost` | `methodology` | 2 | user, model | — | — |
| `doubt-driven-development` | `methodology` | 2 | user, model | `$skill{investigate-first}`, `$skill{critical-thinking}` | — |
| `external-tools` | `methodology` | 2 | user, model | — | — |
| `incremental-implementation` | `methodology` | 2 | user, model | `$skill{loop-programming}` | — |
| `investigate-first` | `methodology` | 2 | user, model | `$skill{debugging}`, `$skill{one-shot-patch}` | `$skill{minimal-root-cause}` |
| `loop-programming` | `methodology` | 2 | user, model | `$skill{incremental-implementation}` | — |
| `minimal-root-cause` | `methodology` | 2 | user, model | `$skill{investigate-first}`, `$skill{debugging}`, `$skill{one-shot-patch}` | — |
| `modern-stack` | `methodology` | 2 | user, model | — | — |
| `observability-and-instrumentation` | `methodology` | 2 | user, model | — | — |
| `one-shot-patch` | `methodology` | 2 | user, model | `$skill{investigate-first}`, `$skill{debugging}` | — |
| `refactoring` | `methodology` | 2 | user, model | — | — |
| `repository-onboarding` | `methodology` | 2 | user, model | — | — |
| `reuse-first` | `methodology` | 2 | user, model | — | — |
| `review-methodology` | `methodology` | 2 | user, model | — | — |
| `source-driven-development` | `methodology` | 2 | user, model | — | — |
| `spec-driven-development` | `methodology` | 2 | user, model | — | — |
| `test-driven-development` | `methodology` | 2 | user, model | — | — |
| `handoff` | `orchestration` | 2 | user, model | — | — |
| `save-session` | `orchestration` | 2 | user, model | — | — |
| `subagent-capsule` | `orchestration` | 2 | user, model | — | — |
| `unwind` | `orchestration` | 2 | user, model | — | — |
| `using-agent-skills` | `orchestration` | 2 | user, model | — | — |
| `deepwiki` | `research` | 2 | user, model | — | — |
| `external-research` | `research` | 2 | user, model | — | — |
| `drill` | `safety` | 2 | user | — | — |
| `safeguard` | `safety` | 2 | user, model | — | — |
| `salvage` | `safety` | 2 | user | — | — |
| `retrospect` | `self-learning` | 2 | user, model | — | — |
| `skill-feedback` | `self-learning` | 2 | user, model | — | — |
| `docker-agent-config` | `tools` | 2 | user, model | — | — |
| `npm-publish` | `tools` | 2 | user, model | — | — |
| `sarif-to-annotations` | `tools` | 2 | user, model | — | — |
| `skillmaker` | `tools` | 2 | user, model | — | — |
| `skills-cli` | `tools` | 2 | user, model | — | — |
| `tsdown` | `tools` | 2 | user, model | — | — |
| `writing-great-skills` | `tools` | 2 | user, model | — | — |
| `debugging` | `troubleshooting` | 2 | user, model | `$skill{investigate-first}`, `$skill{one-shot-patch}` | — |
| `performance-investigation` | `troubleshooting` | 2 | user, model | — | — |
| `evidence` | `verification` | 2 | user, model | — | — |
| `evidence-lite` | `verification` | 2 | user, model | — | — |
| `backlog` | `workflow` | 2 | user, model | — | — |
| `ci-cd-and-automation` | `workflow` | 2 | user, model | — | — |
| `ci-local` | `workflow` | 2 | user, model | — | — |
| `e2e` | `workflow` | 2 | user, model | — | — |
| `git-commit` | `workflow` | 2 | user, model | — | — |
| `git-push` | `workflow` | 2 | user, model | — | — |
| `git-reset` | `workflow` | 2 | user, model | — | — |
| `git-workflow-and-versioning` | `workflow` | 2 | user, model | — | — |
| `harvest` | `workflow` | 2 | user | — | — |
| `resolving-merge-conflicts` | `workflow` | 2 | user, model | — | — |
| `shadow-fork` | `workflow` | 2 | user, model | — | — |
| `shared-plan` | `workflow` | 2 | user, model | — | — |

## Disambiguation (use this, not that)

- **`$skill{act}`** — Use when the user invokes /act on a PR/MR, /act with no arguments (uses the PR in the current conversation context), or /act <context> with context ∈ {pr, plan, backlog, harvest}. Resolves threads in product code (or posts a substantive in-thread reply), commits, then closes threads. Never resolve-only. Harvest (collecting threads) lives in /harvest; triage (priority / grouping / wontfix) lives in /backlog. /act is the fix loop, not the collect or triage. Use this, not `$skill{github-pr-review}`, `$skill{code-review-and-quality}`.
- **`$skill{github-pr-review}`** — Use when the user asks for a GitHub pull request review or wants review comments prepared for a PR on github.com. Use this, not `$skill{code-review-and-quality}`.
- **`$skill{two-axis-review}`** — Review the changes since a fixed point (commit, branch, tag, or merge-base) along two independent axes — Standards (does the code follow the repo's documented coding standards plus a Fowler smell baseline?) and Spec (does the code faithfully implement the originating issue / PRD / spec?). Runs both reviews in parallel sub-agents. Distinct from $skill{github-pr-review} (single-axis) and $skill{act} (thread remediation); this skill holds the two-axis discipline. Use this, not `$skill{github-pr-review}`, `$skill{code-review-and-quality}`.
- **`$skill{code-review-and-quality}`** — Conducts multi-axis code review. Use before merging any change. Use when reviewing code written by yourself, another agent, or a human. Use when you need to assess code quality across multiple dimensions before it enters the main branch. Use this, not `$skill{github-pr-review}`.
- **`$skill{doubt-driven-development}`** — Subjects every non-trivial decision to a fresh-context adversarial review before it stands. Use when correctness matters more than speed, when working in unfamiliar code, when stakes are high (production, security-sensitive logic, irreversible operations), or any time a confident output would be cheaper to verify now than to debug later. Use this, not `$skill{investigate-first}`, `$skill{critical-thinking}`.
- **`$skill{incremental-implementation}`** — Delivers changes incrementally. Use when implementing any feature or change that touches more than one file. Use when you're about to write a large amount of code at once, or when a task feels too big to land in one step. Use this, not `$skill{loop-programming}`.
- **`$skill{investigate-first}`** — Use before editing when a bug, task, failing test, or code area is not yet understood. Guides agents to inspect files, search symbols and errors, reproduce a failure when practical, and produce evidence before any patching. Useful for weak-model stability, unknown codebases, root-cause analysis, and preventing chaotic edits. Use this, not `$skill{debugging}`, `$skill{one-shot-patch}`.
- **`$skill{loop-programming}`** — Run bounded, validator-driven loops for tasks needing repeated inspect, modify, execute, and verify cycles. Use when the agent must iterate on a repository until measurable criteria pass: failing tests, debugging, refactoring, multi-file changes, performance thresholds. Trigger for "keep iterating until tests pass", "fix the repository autonomously", or "refactor and prove nothing broke". Not for one-shot explanations, tiny edits, or unbounded exploration. Use this, not `$skill{incremental-implementation}`.
- **`$skill{minimal-root-cause}`** — Use before patching code when the task may cause overengineering, duplicate logic, unnecessary dependencies, or symptom-only bug fixes. Enforces laziness about solution, rigor about understanding and verification. Climb the laziness ladder before editing. Use this, not `$skill{investigate-first}`, `$skill{debugging}`, `$skill{one-shot-patch}`.
- **`$skill{one-shot-patch}`** — Use when the relevant file and fix hypothesis are known and the agent needs to make exactly one narrow change, then verify it. Prevents stacked fixes, broad refactors, and chaotic iteration. Best for isolated bug fixes after investigation has identified the likely cause. Use this, not `$skill{investigate-first}`, `$skill{debugging}`.
- **`$skill{debugging}`** — Use when an agent is confronted with a runtime failure, wrong output, flaky behavior, regression, performance regression, or crash and needs a disciplined debugging loop. Covers the 4-phase Reproduce → Hypothesize → Test → Fix methodology, stack-trace and log analysis, binary-search regression isolation, and strategic print/debug instrumentation. Built on top of $skill{investigate-first} and feeds into $skill{one-shot-patch}. Use this, not `$skill{investigate-first}`, `$skill{one-shot-patch}`.

## Decision tree

- **Need to understand before editing?** → `$skill{investigate-first}`
- **Have a runtime failure or regression?** → `$skill{debugging}`
- **Know the exact fix and want one narrow change?** → `$skill{one-shot-patch}`
- **Before patching, want to avoid overengineering or symptom-only fixes?** → `$skill{minimal-root-cause}`
- **Need adversarial review of a non-trivial decision?** → `$skill{doubt-driven-development}`
- **Implementing a multi-file or large change?** → `$skill{incremental-implementation}`
- **Need repeated inspect-edit-validate cycles with explicit stop conditions?** → `$skill{loop-programming}`
- **Reviewing a PR on GitHub?** → `$skill{github-pr-review}`
- **End-to-end fixing of PR/MR threads on a repo?** → `$skill{act}`
- **Multi-axis quality review before merge?** → `$skill{code-review-and-quality}`
