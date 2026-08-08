# ADR-0001: Selective import from mattpocock/skills

- **Status:** Accepted
- **Date:** 2026-07-23
- **Author:** Mavis (import workflow)
- **Upstream source:** <https://github.com/mattpocock/skills>

## Context

mattpocock/skills is a mature, opinionated set of agent skills (mattpocock's "Skills For Real Engineers") built around a small, composable philosophy. Several of its skills overlap with concepts we already cover, but a subset offer genuinely new disciplines that the current repo lacks.

The goal of this import is to take **only the value-add** — not to mirror the upstream set. The constraint from the maintainer was explicit: avoid duplication with existing skills.

## What was imported (5 skills)

| New skill | Path | Why it earns a place |
|---|---|---|
| `prototype` | `skills/engineering/prototype/` | No existing skill answers "throwaway code for a design question" with explicit LOGIC vs. UI branches. |
| `handoff` | `skills/orchestration/handoff/` | Pairs with `save-session` and `unwind`; we had durable cross-work preservation and parent-collapse but no **context-window hand-off** to a fresh session. |
| `resolving-merge-conflicts` | `skills/workflow/git/resolving-merge-conflicts/` | `act` covers PR-thread conflicts; nothing covers `git merge` / `git rebase` markers. The by-intent, no-`--abort` discipline is unique. |
| `writing-great-skills` | `skills/tools/writing-great-skills/` | Companion to `skillmaker`: `skillmaker` is the **procedure** (how to scaffold a new skill), `writing-great-skills` is the **craft** (how to make it fire predictably). The two layers were missing. |
| `two-axis-review` | `skills/code-review/two-axis-review/` | Existing `github-pr-review` / `mr-address-review` / `act` are **tool runners** (single-axis, platform-specific). The **discipline** of separating Standards from Spec into parallel sub-agents is the contribution. The name avoids collision with the `code-review/` category. |

Each new skill:

- Sets `source: theplenkov-ai/skills` per `AGENTS.md § Skill source metadata`. **Note**: the existing convention in `AGENTS.md § Skill source metadata` lists `ThePlenkov/skills` as the default, but this repo lives at `theplenkov-ai/skills` (a private mirror with the same description). The `source:` field is therefore set to the host repo (where the skill actually lives), so `$skill{skill-feedback}` routes findings to the right destination. See `§ A note on the source: convention` below.
- Records `upstream: mattpocock/skills` in frontmatter `metadata:` for traceability.
- Includes an HTML-comment block at the top of `SKILL.md` declaring the upstream path and any non-semantic adaptations.
- Replaces mattpocock-specific infrastructure references (e.g. `/setup-matt-pocock-skills`, `$TMPDIR` Linux/macOS) with theplenkov-ai conventions (`$skill{...}` cross-refs, OS-portable instructions, repo-local equivalents).

## A note on the `source:` convention

`AGENTS.md § Skill source metadata` declares `ThePlenkov/skills` as the default
`source:` value. The 80 pre-existing skills in this repo all use that value.
The five new skills imported by this ADR instead use `source:
theplenkov-ai/skills`, because this repo is hosted at
`theplenkov-ai/skills` (verified via `gh api repos/theplenkov-ai/skills` on
2026-07-23 — `ThePlenkov/skills` and `theplenkov-ai/skills` are two separate
private repositories with the same `Personal skills` description; they appear
to be mirror repos under the same maintainer).

The `source:` value is what `$skill{skill-feedback}` reads at runtime to
decide where to post findings. Setting it to the host repo
(`theplenkov-ai/skills`) means feedback for the imported skills lands in
this repo, which is the correct behaviour. The convention in `AGENTS.md`
predates the existence of the mirror and should be updated by a follow-up
PR (out of scope here) to call out the mirror and the routing rule.

## What was NOT imported, and why

| Upstream skill | Why we skipped |
|---|---|
| `grilling` + `grill-me` | Duplicates `coaching/interview-me` (which has a confidence number and richer when-to-use rules). |
| `grill-with-docs` | Output differs from `methodology/idea-refine` (one-pager) but the discipline is similar; we prefer to keep `idea-refine` and add the glossary/ADR flavour to `documentation-and-adrs` instead. |
| `wayfinder` | `workflow/planning/planning-and-task-breakdown` + `shared-plan` cover the same surface at our scale. Re-evaluate when we land a multi-session build that exceeds one window. |
| `tdd` | `methodology/test-driven-development` already covers the same ground; the anti-pattern section (tautological / implementation-coupled / horizontal slicing) is the borrow candidate (see below). |
| `diagnosing-bugs` | `troubleshooting/debugging` already covers the 4-phase methodology; the "tight feedback loop / red-capable" framing is the borrow candidate (see below). |
| `code-review` | Renamed to `two-axis-review` (above) to avoid name collision. |
| `to-spec` / `to-tickets` / `implement` | Duplicates the SDD chain we already have (`methodology/sdd/spec-driven-development` + `workflow/planning/planning-and-task-breakdown` + `methodology/test-driven-development`). |
| `codebase-design` | Vocab (module, depth, seam, leverage, locality) is excellent but the existing `engineering/architecture-review` covers the surface. Borrow vocab into a shared reference doc, not a new skill. |
| `domain-modeling` | `workflow/documentation-and-adrs` already covers ADR discipline. The glossary-side "active sharpening" concept is a borrow candidate. |
| `improve-codebase-architecture` | `behavior/architecture-review` is broader. |
| `research` | `research/deepwiki` is GitHub-specific and the general "background subagent + primary sources" pattern is already documented there. |
| `triage` | `code-review/triage-issue` covers the GitHub/GitLab path. |
| `setup-matt-pocock-skills` | Tightly coupled to mattpocock's issue-tracker expectations; our `dotagents` plays the equivalent role. |
| `in-progress/*` | Not stable upstream. |

## Lessons borrowed (Tier C — ideas to fold into existing skills)

The following three upstream concepts are sharper than what we currently have and should be folded into the existing skills (not added as new skills):

1. **TDD anti-patterns** → fold into `methodology/test-driven-development`:
   - **Tautological** — assertion recomputes the expected value the way the code does; passes by construction and can never disagree with the code. Expected values must come from an independent source of truth.
   - **Implementation-coupled** — mocks internal collaborators, tests private methods, asserts through a side channel. The tell: the test breaks on refactor with no behaviour change.
   - **Horizontal slicing** — writing all tests first, then all implementation. Tests verify _imagined_ behaviour, go insensitive to real changes, and lock in structure before understanding. Work in **vertical slices** instead — one test → one implementation → repeat, each a **tracer bullet** that responds to what the last cycle taught.

2. **"Tight feedback loop / red-capable" framing** → fold into `troubleshooting/debugging`:
   - Phase 1 is the skill. If you have a **tight** pass/fail signal for the bug (one that goes red on _this_ bug), you will find the cause. If you don't, no amount of staring at code will save you.
   - Tighten the loop as a product: faster, sharper signal, more deterministic. A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is a debugging superpower.
   - **Completion criterion for Phase 1**: a single command that has **already been run** (paste the invocation and its output), is **red-capable** (asserts the user's exact symptom, not "runs without erroring"), is **deterministic**, and is **fast** (seconds, not minutes).

3. **"Shared language sharpens the loop"** → already in spirit across `coaching/interview-me`, `methodology/idea-refine`, and `workflow/documentation-and-adrs`; no separate change required. The lesson is: when interviewing / refining, treat terminology that conflicts with the existing `CONTEXT.md` as a hard stop, not a soft note.

## Consequences

- The repo grows by 5 skills (from 80 to 85, per the regenerated graph).
- `.claude-plugin/marketplace.json` category descriptions were updated to mention the new skills in passing.
- `AGENTS.md` layout block was updated to reference the new sub-skills.
- `.agents/skills/` flat symlink view regenerated by `npm run install:skills`.
- `docs/graphs/generated/*` regenerated by `npm run graph:update` (85 skills, 163 edges — the +2 over the initial 161 came from `handoff → review-methodology` and `skillmaker → writing-great-skills`, both added in subsequent `/act` review feedback commits).
- The Skills Graph CI workflow should remain green because the graphs are committed alongside the skill changes.
- `skills-lock.json` is unchanged: all 5 skills are local (`sourceType: local`); none require the `npx skills add` install path.
- Future feedback should route to `theplenkov-ai/skills` (per `source:` in each new frontmatter). The `metadata.upstream` field is informational only.

## Verification

- `npm run install:skills` — 85 skills linked (was 80).
- `npm run graph:update` — 85 per-skill graphs + `index.md` written.
- `npm run check:os` — no new POSIX-only patterns introduced (the 75 pre-existing ones are in unrelated skills).
- `npm run check:readme-categories` — 17 categories, 18 plugins in sync.
- `npm run typecheck` — clean.
- `npm run validate` — `generated skills-index.json is valid`.
- `npm test` — pre-existing `js-yaml` resolution failures in `skills/workflow/testing/e2e/scripts/framework/*` are unrelated to this import (those tests were failing on `main` before this branch was created).
