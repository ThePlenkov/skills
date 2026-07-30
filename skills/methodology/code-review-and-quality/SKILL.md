---
name: code-review-and-quality
description: Conducts multi-axis code review. Use before merging any change. Use when reviewing code written by yourself, another agent, or a human. Use when you need to assess code quality across multiple dimensions before it enters the main branch.
metadata:
  tier: 2
  triggers:
    - user
    - model
  conflicts_with:
    - github-pr-review
  source: theplenkov-ai/skills
---

# Code Review and Quality

## Overview

Multi-dimensional code review with quality gates. Every change gets
reviewed before merge — no exceptions. Review covers five axes:
correctness, readability, architecture, security, performance.

**Approval standard:** Approve when it definitely improves overall
code health, even if it isn't perfect. Don't block because it isn't
exactly how you would have written it. If it improves the codebase and
follows the project's conventions, approve it.

## When to Use

- Before merging any PR or change
- After completing a feature implementation
- When another agent or model produced code you need to evaluate
- When refactoring existing code
- After any bug fix (review both the fix and the regression test)

## The Five-Axis Review

The per-axis checklist (the questions to walk through on a real review)
lives in
[`references/axes-checklist.md`](references/axes-checklist.md):

| Axis | Asks |
|---|---|
| **1. Correctness** | Does the code do what it claims? Edge cases and error paths handled? |
| **2. Readability & Simplicity** | Can another engineer understand it without the author explaining? Abstractions earning their complexity? |
| **3. Architecture** | Does it fit the system? Does the refactor reduce complexity or just relocate it? |
| **4. Security** | For details, see $skill{security-and-hardening}. Any vulnerabilities introduced? |
| **5. Performance** | For details, see $skill{performance-optimization}. Any bottlenecks introduced? |

Two recurring smells worth flagging explicitly: **a new conditional
bolted onto an unrelated flow** (push into a helper or state) and
**repeated conditionals on the same shape** (signal a missing model or
dispatcher).

## Structural Remedies

When you flag a structural problem, propose the move — not just the
problem. A review that only says "this is complex" leaves the author
guessing. Reach for a named restructuring:

- **Replace a chain of conditionals** with a typed model or dispatcher.
- **Collapse duplicate branches** into a single clearer flow.
- **Separate orchestration from business logic** so each reads alone.
- **Move feature-specific logic** out of a shared module into the
  package that owns the concept.
- **Reuse the canonical helper** instead of a bespoke near-duplicate.
- **Make a type boundary explicit** so downstream branching disappears.
- **Delete a pass-through wrapper** that adds indirection without
  clarifying the API.
- **Extract a helper, or split a large file** into focused modules.

Prefer the remedy that removes moving pieces over one that spreads the
same complexity around.

## Change Sizing

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if it's a single logical change.
~1000 lines changed  → Too large. Split it.
```

A small diff can still push a file past a healthy boundary — around
1000 *total* lines in a single file is a common inspection signal, not
a hard cap. When a change materially grows an already-large file, ask
whether to extract helpers, subcomponents, or modules *first*, before
piling more on. Decompose, then add.

**Separate refactoring from feature work.** A change that refactors
existing code and adds new behavior is two changes — submit them
separately. Small cleanups (variable renaming) can be included at
reviewer discretion.

### Splitting strategies when a change is too large

| Strategy | How | When |
|----------|-----|------|
| **Stack** | Submit a small change, start the next one based on it | Sequential dependencies |
| **By file group** | Separate changes for groups needing different reviewers | Cross-cutting concerns |
| **Horizontal** | Create shared code/stubs first, then consumers | Layered architecture |
| **Vertical** | Break into smaller full-stack slices of the feature | Feature work |

**When large changes are acceptable:** Complete file deletions and
automated refactoring where the reviewer only needs to verify intent,
not every line.

## Change Descriptions

**First line:** Short, imperative, standalone. "Delete the FizzBuzz RPC"
not "Deleting the FizzBuzz RPC." Must be informative enough that
someone searching history can understand the change without reading the
diff.

**Body:** What is changing and why. Include context, decisions, and
reasoning not visible in the code itself. Link to bug numbers,
benchmark results, or design docs where relevant. Acknowledge approach
shortcomings when they exist.

**Anti-patterns:** "Fix bug," "Fix build," "Add patch," "Moving code
from A to B," "Phase 1," "Add convenience functions."

## Review Process

A five-step process — context, tests, implementation, categorise,
verify. The step-by-step playbook (questions to ask on each step, the
severity table, the leading-with-what-matters rule) lives in
[`references/review-process.md`](references/review-process.md).

## Multi-Model Review Pattern

```
Model A writes → Model B reviews → Model A addresses → Human decides
```

Different models have different blind spots; this catches what a
single model would miss. A copy-pasteable prompt for the review agent
lives in
[`references/review-templates.md`](references/review-templates.md).

## Dead Code Hygiene

After any refactoring or implementation change, identify code that is
now unreachable or unused, list it explicitly, and **ask before
deleting** — "Should I remove these now-unused elements: [list]?"
Don't silently delete things you're not sure about. A copy-paste
template for the proposal lives in
[`references/review-templates.md`](references/review-templates.md).

## Working with Authors

**Review Speed.** Slow reviews block entire teams. The cost of
context-switching to review is less than the waiting cost imposed on
others. Respond within one business day (this is the maximum, not the
target); prioritise fast individual responses over quick final
approval. For large changes, ask the author to split them rather than
reviewing one massive changeset.

**Handling Disagreements.** Hierarchy: (1) technical facts and data
override opinions, (2) style guides are authority on style, (3) design
judged on engineering principles not personal preference, (4)
codebase consistency is acceptable if it doesn't degrade overall
health. Don't accept "I'll clean it up later" — experience shows
deferred cleanup rarely happens. Require cleanup before submission
unless it's a genuine emergency; otherwise require filing a bug with
self-assignment.

**Honesty in Review.** Don't rubber-stamp ("LGTM" without evidence).
Don't soften real issues. Quantify problems when possible. Push back
on approaches with clear problems — sycophancy is a failure mode in
reviews. Accept override gracefully if the author has full context;
comment on code, not people.

## Dependency Discipline

The policy is "prefer standard library and existing utilities over new
dependencies" — every dependency is a liability. The full pre-add
checklist and the upgrade-by-one-dep workflow (changelog review,
lockfile diff, test verification) live in
[`references/dependency-discipline.md`](references/dependency-discipline.md).

## The Review Checklist

The PR review checklist template (per-section boxes plus the
Approve/Request changes verdict) is in
[`references/review-templates.md`](references/review-templates.md). Use
it as the skeleton of the review body.

## See Also

- Detailed security review: `references/security-checklist.md`
- Performance review checks: `references/performance-checklist.md`
- Per-axis questions: [`references/axes-checklist.md`](references/axes-checklist.md)
- Step-by-step process: [`references/review-process.md`](references/review-process.md)
- Dependency workflow: [`references/dependency-discipline.md`](references/dependency-discipline.md)
- Templates (prompt, dead-code, checklist): [`references/review-templates.md`](references/review-templates.md)

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Working code that's unreadable, insecure, or architecturally wrong creates debt that compounds. |
| "I wrote it, so I know it's correct" | Authors are blind to their own assumptions. Every change benefits from another set of eyes. |
| "We'll clean it up later" | Later never comes. The review is the quality gate — require cleanup before merge, not after. |
| "AI-generated code is probably fine" | AI code needs more scrutiny, not less. It's confident and plausible, even when wrong. |
| "The tests pass, so it's good" | Tests are necessary but not sufficient. They don't catch architecture, security, or readability concerns. |
| "The refactor makes it cleaner" | Relocating complexity isn't reducing it. If the reader still holds the same concepts, it didn't improve. |
| "It's only a small addition to this file" | Small diffs still push files past a healthy size. Judge the resulting structure, not the diff size. |
| "It's just a version bump" | A bump is a behavior change you didn't write. Read the changelog; semver doesn't guarantee no breakage. |
| "I'll upgrade everything in one PR to save time" | A bulk bump that breaks the build hides which package did it. One dep per change. |

## Red Flags

- PRs merged without any review, or only test-pass review
- "LGTM" without evidence of actual review
- Security-sensitive changes without security-focused review
- Large PRs that are "too big to review properly" (split them)
- No regression tests with bug-fix PRs
- Review comments without severity labels
- Accepting "I'll fix it later" — it never happens
- A refactor that moves code around without reducing the concepts a
  reader must hold
- A change that grows an already-large file instead of decomposing it
- New conditionals scattered into unrelated code paths (a missing
  abstraction)
- A bespoke helper that duplicates an existing canonical one, or
  feature logic placed in a shared module
- A bulk "bump dependencies" PR with no changelog review and no
  per-package isolation
- A lockfile change that's hand-edited, uncommitted, or merged without
  reviewing its diff

## Verification

After review is complete:

- [ ] All Critical issues are resolved
- [ ] All Required (no-prefix) changes are resolved or explicitly
      deferred with justification
- [ ] Tests pass; build succeeds
- [ ] The verification story is documented (what changed, how verified)
- [ ] Dependency upgrades reviewed against changelog, isolated per
      package, verified by a green suite, lockfile diff reviewed

**Presumptive blockers** (surface and propose the simpler design;
escalate to Required only when the change actively makes structure
worse): a refactor that relocates complexity instead of reducing it; a
change that pushes a file past the size boundary with no
decomposition; feature logic added to a shared module; a near-duplicate
of an existing canonical helper; a silent fallback that hides an
unclear invariant.
