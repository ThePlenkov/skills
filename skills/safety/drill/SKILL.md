---
name: drill
description: Scoped descent primitive for agent systems. Creates isolated execution frames with filesystem materialization, session tracking, and controlled context flow. Each drill narrows scope, materializes as a directory tree, and enables delegation with strict leak control.
metadata:
  tags:
    - context-isolation
    - scope-management
    - filesystem-materialization
    - session-tracking
    - delegation
  author: petr-plenkov
  version: "1.0.0"
tier: 2
triggers: [user, model]
source: theplenkov-ai/skills
---

# Drill

`/drill` is a scoped descent primitive for agent systems. It creates an isolated work frame, narrows the active problem, materializes that frame as a directory in the filesystem, and optionally delegates focused work to subagents. `/undrill` is the upward traversal primitive — alias for `/drill { direction = up }`.

## Intent

Control context growth, reduce cross-task contamination, and make investigation state durable. Subagents receive only relevant context and return a compressed result instead of sharing a full transcript, which improves focus and contains failures.

The design goal is **narrow → investigate → trace → materialize**. Every drill is both an execution frame and a reusable knowledge artifact in the project tree.

## Commands

```text
/drill { direction = down | up, ...options }
/undrill                       # alias for /drill { direction = up }
```

`direction = down` enters a narrower frame under the current drill; `direction = up` exits, consolidates findings, and returns control to the parent. If `direction` is omitted, default to `down`.

## Mental model

A hybrid of call stack, case folder, and recursive knowledge tree. Each downward drill creates a child frame with tighter scope; each upward drill closes that frame and promotes only curated outputs.

Key invariant: **isolation**. A child frame must not inherit the full parent transcript, and the parent must not absorb raw child reasoning. Only task-relevant inputs go down; only summarized outputs come back up.

## Filesystem model

Every drill is a directory with a same-named markdown file inside it. Nested drills live under `.drills/` so the tree itself is the index:

```text
.drills/
  2026-07-11-132105-a1b2c3-api-debug/
    2026-07-11-132105-a1b2c3-api-debug.md
    evidence-log-snippet/
      evidence-log-snippet.md
    sql-plan-capture/
      sql-plan-capture.md
    .drills/
      2026-07-11-132530-d4e5f6-db-optim/
        2026-07-11-132530-d4e5f6-db-optim.md
```

Documents live next to the drill file so they remain reusable outside it. See [references/templates.md](references/templates.md) for canonical templates.

## Naming convention

```text
YYYY-MM-DD-HHMMSS-sha-slug
```

Example: `2026-07-11-132105-a1b2c3-api-debug`. Easy to parse, lexically sortable, resilient when slugs collide.

## Execution semantics

### Downward drill

1. Validate the task is strictly narrower than the current frame.
2. Create the child directory under the current frame's `.drills/` directory.
3. Create the child markdown file using the directory name.
4. Copy in only the minimum necessary context, not the full parent transcript.
5. Start a new execution frame with a focused objective and optional delegation plan.

### Upward drill

1. Finalize the current drill file.
2. Compress findings into a parent-consumable result.
3. Link important evidence and artifacts.
4. Propagate only selected outputs upward — never the entire child history.
5. Return control to the parent frame.

### `/undrill`

Syntactic sugar for the upward operation — identical validation, persistence, and merge behavior.

## Delegation

A drill may delegate to subagents. When it does:

- Each subagent gets a fresh, isolated context window.
- Each subagent receives only the task description and selected supporting materials.
- Subagents do not read sibling contexts or the full parent history.
- The parent receives only a compressed return object, not the subagent transcript.

Context bleed and cross-task contamination are the core reasons to isolate subagents in the first place.

## Cursor file

`.drills/cursor` holds exactly one line: the short SHA of the current drill. To resolve: read SHA → search `.drills/` recursively for a matching directory → use as `current_drill`.

The drill file itself stores `parent` in frontmatter, so the cursor + tree = full hierarchy.

## Retrieval

The materialized tree doubles as a project knowledge base. Later runs can retrieve `Findings`, `Return Payload`, and linked documents instead of replaying full transcripts. This is the broader goal: compress context and communicate through curated outputs.

## Cross-references

- `$skill{investigate-first}` — narrow scope before editing.
- `$skill{unwind}` — expand scope by collapsing solved branches.
- `$skill{retrospect}` — capture learnings from mistakes.
- `$skill{persistent-memory}` — persistent knowledge across sessions.

For templates, frontmatter fields, full example workflows, validation rules, scope rules, error handling, state machine, merge/trace policies, and recommended defaults — see [references/templates.md](references/templates.md) and [references/troubleshooting.md](references/troubleshooting.md).
