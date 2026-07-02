---
name: pr-handoff
description: Generate a self-contained handoff for the next agent working on a subagent-driven PR pipeline. Use at the end of each subagent task to produce (1) a docs/handoff/ entry that captures state, lessons, and the next contract, (2) an updated docs/lessons-learned.md, and (3) a scaffold test file + branch + draft PR for the next subagent. Designed for projects where each PR is a self-contained unit and the next agent must be able to pick up from a fresh context with zero conversation history.
metadata:
  tags:
    - workflow
    - handoff
    - pr-pipeline
    - subagent-orchestration
  author: petr-plenkov
  version: "1.0.0"
---

# PR Handoff

Generate a durable handoff between subagent-driven PRs. The output is **self-contained**: an external agent (different machine, fresh context, no conversation history) must be able to pick up from the handoff doc alone.

## When to Use

- At the end of every subagent task, just before opening the PR.
- When a project is structured as N PRs each landing a subagent's work and the next agent must continue without conversation context.
- When the human-readable "next agent" prompt is too long to copy-paste (the prompt should be the final output of this skill).

## When NOT to Use

- Single-shot tasks with no follow-up subagent (use `save-session` instead).
- Projects where the orchestrator + each subagent run in the same session and conversation context (use direct handoff in conversation).
- The handoff doc already exists and is up-to-date.

## Inputs

The skill expects the following to already be true (gather them yourself first):

1. **`main` HEAD** — the latest squash-merge SHA on the main branch.
2. **Current subagent's PR number + URL** — the work that just landed.
3. **Next subagent number + name + contract doc path** — what the next agent picks up.
4. **The lessons-learned rules** — the cross-cutting patterns extracted from this and prior subagents.
5. **A scaffold (or expected scaffold shape) for the next subagent** — the RED-phase test file or empty implementation file the next subagent will fill in.

## Workflow

### Step 1. Inspect the current state

```bash
git fetch origin main
git log origin/main --oneline -10
gh pr list --state all --limit 5
ls docs/handoff/ 2>/dev/null   # existing handoff chain
cat docs/lessons-learned.md 2>/dev/null
```

If the working tree is dirty, commit or stash before continuing.

### Step 2. Write a new handoff doc

Create `docs/handoff/YYYY-MM-DD-subagent-NN-complete.md` (or `-in-progress` if you are mid-task). Use today's actual date from the environment, never inferred from memory.

The handoff doc must include, in this order:

1. **TL;DR table** — a row per merged PR so far with: PR #, title, commit SHA, date.
2. **Next task** — the single line the next agent needs to read first.
3. **State** — what is on `main` (the recent git log), the repo shape (the directory tree at the granularity the next agent needs), the test count.
4. **CI state** — which 5 main gates are green, which external services are SUCCESS/FAILURE (CodeScene, Codacy, etc. are often opaque from the sandbox).
5. **What landed in the just-merged PR** — files added, what the implementation does, what edge cases the tests cover.
6. **New patterns** — anything the just-merged PR revealed that is reusable: file-size budgets, sub-entrypoint patterns, etc. Each new pattern becomes a new rule in `lessons-learned.md`.
7. **The 7+1+1 = 9 (or more) rules from `lessons-learned.md`** — recap with the cross-cutting rules, each with the specific concrete hit and falsification trace.
8. **Operational contract** — the exact subagent loop (PATCHER → VERIFIER → REVIEWER → iterate → commit → /act → merge).
9. **Plan for the next subagent** — name, contract doc reference, what to read, the exact verification commands, file scope (allowed + forbidden), settlement rules that apply, hints for what the next subagent is likely to get wrong.
10. **File history** — list the prior handoff docs in `docs/handoff/`. This is the agent's reading order.

The handoff doc must be **self-contained**. A new agent in a new sandbox must be able to start from this doc + the project state alone.

### Step 3. Update `docs/lessons-learned.md` (if needed)

If the just-merged PR revealed a new pattern, add a new rule. Format:

```markdown
### Rule N (NEW, from subagent NN). <one-sentence name>

**Why it matters:** <the principle>.

**Patterns:**

- <pattern 1>
- <pattern 2>

**Concrete hit:** <commit SHA, file:line, what the agent did wrong, what was changed>.
```

Then update the "Synthesis: subagent-instruction template" section to reference the new rule.

### Step 4. Create a branch off main for the next subagent

```bash
git checkout -b task/NN-task-name origin/main
```

### Step 5. Add the RED-phase test scaffold

The contract doc (`docs/agent-tasks/NN-*.md`) lists "Required tests" with their public surface. Write a test file at the path the contract specifies, with all the tests in place, that fails because the implementation file does not exist.

Verify RED:

```bash
cd packages/<name>  # or wherever the contract says
npx vitest run src/<path>/<file>.test.ts
# Expect: "Test Files 1 failed (1) / Tests no tests" — the expected TDD state
```

### Step 6. Commit + push + open draft PR

```bash
git add -A
git commit -m "docs: add subagent-NN handoff + lessons Rules N, N+1; scaffold <name> RED tests"
git push -u origin task/NN-task-name
gh pr create --base main --head task/NN-task-name --draft \
  --title "feat(<scope>): <task-name> (subagent PR NN)" \
  --body "..."
```

The PR body should mirror the handoff doc's "what is in this PR" section so a reviewer can see the scope without leaving GitHub.

### Step 7. Output the next-agent prompt

Write the final output to stdout:

```
NEXT-AGENT PROMPT — subagent NN (<name>)

<full self-contained prompt the next agent will receive>
```

The prompt must include:
- Repo URL and PR URL
- Branch name and current SHA
- Explicit `git fetch && git checkout` instructions
- The list of docs to read (with full paths)
- The contract (public surface + 5+ test names)
- The 5–9 rules from lessons-learned (or "see docs/lessons-learned.md")
- The exact loop to run
- The exact verification commands (tsc, vitest, build, vsce)
- The merge instructions
- The constraints (no new deps, no setTimeout, no rewriting built-ins)
- The CI caveats (CodeScene + Codacy are opaque)
- The handoff instructions for the next-next agent

The prompt should be ~80-120 lines. Long enough to be complete; short enough to copy-paste.

## Output

Report to the user:

```
PR handoff complete:
- Handoff doc: docs/handoff/YYYY-MM-DD-subagent-NN-complete.md
- Lessons updated: docs/lessons-learned.md (Rule N added, ...)
- Branch: task/NN-task-name
- Draft PR: <URL>
- Next-agent prompt: <in this output>
```

## Commit Rules

- A handoff is a local commit. Do NOT push until the user confirms.
- The handoff commit can include the scaffold test file, the handoff doc, and the lessons-learned update. Three things in one commit is fine.
- Do NOT include the implementation file (it doesn't exist yet — that's the next agent's job).
- The handoff commit message must be descriptive: `docs: add subagent-NN handoff + lessons Rules N, M; scaffold <name> RED tests`.

## Cross-References

- `shared-plan` skill — for the broader project planning that this skill feeds into.
- `save-session` skill — for capturing a session that does NOT involve a subagent PR handoff.
- `act` skill — for the post-merge /act workflow (which runs after the handoff, on the just-opened PR).
- `retrospect` skill — for the pattern of capturing what was learned.
- `subagent-capsule` skill — for the structure of a PATCHER subagent's context capsule.
