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
---

# Drill Skill Specification

`/drill` is a scoped descent primitive for agent systems. It creates a new, isolated work frame, narrows the active problem, materializes that frame as a directory in the filesystem, and optionally delegates focused work to subagents. `/undrill` is the upward traversal primitive and a convenience alias for `/drill { direction = up }`.

## Intent

The skill exists to control context growth, reduce cross-task contamination, and make investigation state durable. In isolated subagent patterns, each worker receives only relevant context and returns a compressed result instead of sharing a full transcript, which improves focus and contains failures.

The design goal is not only "narrow the scope," but "narrow, investigate, trace, and materialize." That means every drill becomes both an execution frame and a reusable knowledge artifact in the project tree.

## Commands

### `/drill`

Primary command:

```text
/drill { direction = down | up, ...options }
```

Semantics:

- `direction = down` enters a narrower frame under the current drill.
- `direction = up` exits one level, consolidates findings, and returns control to the parent frame.
- If `direction` is not provided, the command behaves as `direction = down`.

### `/undrill`

Shortcut form:

```text
/undrill
```

This is an alias for:

```text
/drill { direction = up }
```

That shortcut makes sense because the upward transition is not a separate capability; it is the inverse traversal of the same drill tree with the same merge and closure rules.

## Mental Model

The runtime behaves like a hybrid of a call stack, a case folder, and a recursive knowledge tree. Each downward drill creates a child frame with tighter scope; each upward drill closes that frame and promotes only the curated outputs to the parent.

The key invariant is isolation. A child frame must not inherit the full parent transcript by default, and the parent must not absorb raw child reasoning by default. Only task-relevant inputs go down, and only summarized outputs come back up.

## Filesystem Model

Every drill is materialized as a directory with a same-named markdown file inside it. Nested drills live inside the parent drill's `.drills/` directory so the file tree itself acts as the index.

Example:

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
        trace-query-variance/
          trace-query-variance.md
        .drills/
          2026-07-11-132910-a7b8c9-index-check/
            2026-07-11-132910-a7b8c9-index-check.md
```

This structure preserves recursive descent physically, keeps child drills visibly attached to their parent, and avoids the need for a separate registry file while the tree remains the source of truth.

## Naming Convention

The canonical drill directory and primary file name format is:

```text
YYYY-MM-DD-HHMMSS-sha-slug
```

Example:

```text
2026-07-11-132105-a1b2c3-api-debug
```

Properties:

- `YYYY-MM-DD` is an ISO-style date segment.
- `HHMMSS` is a compact time segment.
- `sha` is a short unique identifier, typically 6 to 8 hexadecimal characters.
- `slug` is a human-readable descriptor.

This format is easy to parse, lexically sortable by creation time, and resilient when multiple drills share a similar slug.

## Drill Object Types

A drill directory may contain:

- The primary drill file, which defines the scoped investigation.
- Supporting document directories adjacent to that file, which hold evidence, traces, excerpts, or research artifacts.
- A nested `.drills/` directory containing narrower child drills.

Documents are intentionally separate from the drill file so they remain reusable outside the original drill context. The drill references those documents; it does not absorb them into one giant note.

## Scope Rules

A child drill is valid only when it narrows the parent scope. Allowed narrowing patterns include:

- Focusing on one subsystem from a larger system issue.
- Testing one hypothesis from a broader problem statement.
- Inspecting one artifact class, such as logs, traces, schema, or API responses.
- Reducing time range, environment range, or failure surface.

A child drill is invalid if it broadens the question, pivots sideways to a sibling concern, or introduces a new top-level objective. In that case the agent must first move up, then start a fresh sibling drill from the appropriate ancestor with explicit links back to the originating drill.

## Execution Semantics

### Downward drill

`/drill { direction = down }` performs these operations:

1. Validates that the requested task is narrower than the current frame.
2. Creates a new child directory under the current frame's `.drills/` directory.
3. Creates the child markdown file using the same directory name.
4. Copies in only the minimum necessary context, not the full parent transcript.
5. Starts a new execution frame with a focused objective and optional delegation plan.

### Upward drill

`/drill { direction = up }` performs these operations:

1. Finalizes the current drill file.
2. Compresses findings into a parent-consumable result.
3. Links important evidence and artifacts.
4. Propagates only selected outputs upward instead of the entire child history.
5. Returns control to the parent frame.

### `/undrill`

`/undrill` is syntactic sugar for the upward operation and should behave identically in validation, persistence, and merge behavior.

## Current Cursor File (.drills/cursor)

The runtime maintains the current drill position using a single cursor file:

```text
.drills/cursor
```

This file contains exactly one line: the short SHA of the current drill.

Example:

```text
a1b2c3
```

### Resolution

To resolve the current drill:

1. Read `.drills/cursor` → `sha`.
2. Recursively search `.drills/` for a directory whose name contains `sha`.
3. Use that directory as `current_drill`.

This is simple, versionable with git, and enough for navigation because:

- the drill file itself stores `parent` in frontmatter
- `sha` is unique per drill
- and the tree structure encodes the drill hierarchy.

## Delegation Model

A drill may execute directly in the current agent or delegate parts of its work to subagents. Delegation is appropriate for long-running, clearly bounded subtasks, especially research, debugging, and artifact inspection workflows.

When a drill delegates:

- Each subagent gets a fresh, isolated context window.
- Each subagent receives only the task description and the selected supporting materials.
- Subagents do not read sibling contexts or the full parent history.
- The parent receives only a compressed return object, not the subagent transcript.

This is important because context bleed, cross-task contamination, and failure containment are core reasons to isolate subagents in the first place.

## Recommended Options

Command form:

```text
/drill {
  direction = down | up,
  goal="...",
  scope="...",
  problem="...",
  delegate=auto|never|always,
  trace=none|light|full,
  merge=summary|structured|full,
  evidence=link|copy|none,
  slug="..."
}
```

Parameters:

- `direction`: `down` creates nested drill, `up` exits current.
- `goal`: immediate objective of drill.
- `scope`: hard boundary of what's included/excluded.
- `problem`: problem formulation for this frame.
- `delegate`: can runtime spawn subagents.
- `trace`: how much trace to save.
- `merge`: how much material returns upward on undrill.
- `evidence`: how evidence is handled (links, copies, or ignored).
- `slug`: human-readable part of name.

For `/drill { direction = up }` most important are `merge`, `trace` and possibly explicit closure note.

## Drill File Template (with session pointers)

Canonical markdown template:

```md
---
type: drill
id: 2026-07-11-132105-a1b2c3-api-debug
parent: null
created_at: 2026-07-11T13:21:05Z
updated_at: 2026-07-11T13:23:10Z
status: open
agent: orchestrator
direction: down
sha: a1b2c3
slug: api-debug
goal: Identify the root cause of the API 500 error
scope: Only /api/orders, production logs, and database latency evidence
problem: Requests intermittently fail with 500 during concurrent traffic spikes
delegate: auto
trace: light
merge: summary

# Session pointers – who is working here and where to continue
session:
  agent_id: orchestrator
  role: orchestrator
  session_id: sess_01jz8n4x7e
  parent_session_id: null
  spawned_by: null
  mode: direct
  resume_command: null
  resume_uri: null
---

# Scope

What this drill includes, excludes, and why the boundary is narrow enough.

# Problem Statement

The specific issue this drill is trying to resolve.

# Plan

Ordered approach for the drill.

# Findings

Resolved observations, confirmed hypotheses, rejected hypotheses, and current status.

# Evidence

Relative links to adjacent document directories and files.

# Links

References to related drills, ancestor drills, or sibling investigations.

# Return Payload

The exact summary or structured object intended for the parent on undrill.

# Session Continuity

- **Agent**: `{agent.session.agent_id}`
- **Session**: `{agent.session.session_id}`
- **Parent session (if delegated)**: `{agent.session.parent_session_id}`
- **Spawned by**: `{agent.session.spawned_by}`
- **Resume**: `{agent.session.resume_uri || agent.session.resume_command || "continue in current orchestrator session"}`
```

Explanation of the `session` block:

- `agent_id`: which agent owns this drill.
- `role`: `orchestrator` or `subagent`.
- `session_id`: unique session identifier for this agent.
- `parent_session_id`: if this is a subagent drill, the session that spawned it.
- `spawned_by`: agent that created this drill (e.g., `orchestrator`).
- `mode`:
  - `direct` — executed in the owner session directly.
  - `delegated` — executed in a subagent session.
  - `resumed` — this drill was resumed from a previous session.
- `resume_command`: human or CLI command to restore this session.
- `resume_uri`: URI-like pointer to the agent runtime session.

This frontmatter block is the **only place** where session provenance is stored. `.drills/cursor` only says "which drill is current"; the session block says "which agent session owns this drill and how to continue it".

## Supporting Document Template

Adjacent evidence or research documents should be stored as their own directory-plus-file units so they are addressable and reusable independently of a single drill.

Example:

```text
sql-plan-capture/
  sql-plan-capture.md
```

Suggested template:

```md
---
type: document
kind: evidence
created_at: 2026-07-11T13:22:40Z
source: postgres-explain
related_drills:
  - ../2026-07-11-132105-a1b2c3-api-debug.md
---

# Summary

Short description of the artifact.

# Content

Captured logs, excerpts, SQL plans, traces, screenshots, or notes.

# Notes

Why this artifact matters.
```

## State Machine

Recommended drill lifecycle:

- `open`: The drill has been created and is active.
- `blocked`: The drill cannot proceed because evidence or permissions are missing.
- `done`: The drill reached a stable conclusion and has been undrilled.
- `abandoned`: The drill was intentionally stopped and closed without full resolution.

A downward drill creates a new `open` child. An upward drill should change the current drill to `done` or `abandoned`, stamp the closure time, and write the return payload before yielding control upward.

## Parent-Child Contract

Each child drill should define an explicit contract for what it will return to the parent. At minimum, that contract should include:

- A short answer.
- Confidence or certainty level.
- Evidence links.
- Open questions.
- Recommended next action.

This matters because isolated systems trade shared context for focused interfaces. Clear result contracts reduce the information loss that isolation can otherwise introduce.

## Merge Policies

Recommended merge modes for upward traversal:

- `summary`: One concise finding set, ideal by default.
- `structured`: Machine-readable output with fields such as `answer`, `confidence`, `evidence`, and `next_step`.
- `full`: Includes extensive notes and trace references, reserved for deep debugging.

Default behavior should prefer `summary` or `structured` because returning too much child material defeats the purpose of context isolation.

## Trace Policies

Recommended trace levels:

- `none`: No reasoning trace is stored beyond final findings.
- `light`: Key steps, tool actions, and hypothesis changes.
- `full`: Exhaustive debugging trace and artifact trail.

`light` is the practical default because detailed debugging often benefits from traceability, but exhaustive trace should be opt-in due to size and noise.

## Validation Rules

Before creating a downward drill, the runtime should verify:

- There is an active parent frame, unless this is a root drill.
- The new goal is strictly narrower than the parent goal.
- The child inherits only selected context.
- The slug is present and filename-safe.
- The generated name is unique within the target `.drills/` directory.

Before moving upward, the runtime should verify:

- The current drill exists and is active.
- Findings or status are written.
- The return payload is present unless the drill is abandoned.
- Evidence links resolve or are explicitly marked missing.

## Error Handling

Recommended failures:

- Reject nested drill creation if the requested work broadens the scope.
- Reject undrill at the root unless a root-close mode is explicitly allowed.
- Warn when a child returns excessive raw context relative to its merge mode.
- Warn when evidence exists but is unlinked.
- Warn when a sibling drill should be created from a parent instead of from the current drill.

## Retrieval and Knowledge Reuse

Because every drill and document is materialized, the tree doubles as a project knowledge base. The runtime can later retrieve only `Findings`, `Return Payload`, and linked documents instead of replaying full conversational history, which aligns with the broader goal of compressing context and communicating through curated outputs rather than shared transcripts.

## Example Workflow (with session pointers)

Root investigation:

```text
/drill {
  goal="Diagnose intermittent API 500s",
  scope="Only production orders API failures from the last 24h",
  problem="500s occur during concurrency spikes",
  delegate=auto,
  trace=light,
  slug="api-debug"
}
```

Root drill frontmatter:

```yaml
session:
  agent_id: orchestrator
  role: orchestrator
  session_id: sess_01jz8n4x7e
  parent_session_id: null
  spawned_by: null
  mode: direct
```

Nested narrowing step (delegated):

```text
/drill {
  goal="Test whether slow SQL causes request timeouts",
  scope="Only query latency and lock behavior for order lookup",
  delegate=always,
  slug="db-optim"
}
```

Nested drill frontmatter:

```yaml
session:
  agent_id: db-investigator
  role: subagent
  session_id: sess_01jz8n4y2f
  parent_session_id: sess_01jz8n4x7e
  spawned_by: orchestrator
  mode: delegated
  resume_command: /agents resume sess_01jz8n4y2f
  resume_uri: agent://db-investigator/sessions/sess_01jz8n4y2f
```

Return to parent:

```text
/undrill
```

Equivalent explicit form:

```text
/drill { direction = up, merge=structured, trace=light }
```

This workflow matches the hierarchical decomposition pattern in which a parent delegates a narrow question, the child works in isolation, and the parent receives a compressed result suitable for synthesis.

## Recommended Defaults

Recommended defaults for a first implementation:

- `/drill` means `/drill { direction = down }`.
- `/undrill` means `/drill { direction = up, merge=summary, trace=light }`.
- Child drills are created only when scope is narrower.
- Subagents are allowed only when their inputs can be explicitly bounded.
- Upward merges return summaries, links, and evidence references, not raw transcripts.
- The filesystem tree is the canonical index.
- Every drill must have a `session` block with `agent_id` and `session_id`.
- If delegated, the child must include `parent_session_id`, `spawned_by`, and `mode: delegated`.

These defaults preserve the central architectural value of the pattern: focused recursive work with durable artifacts and controlled context flow.

## Cross-References

- `investigate-first` skill — for narrowing scope through investigation before editing
- `unwind` skill — for expanding scope by collapsing solved branches
- `retrospect` skill — for capturing learnings from mistakes
- `memory` skill — for persistent knowledge across sessions
