---
description: Create isolated execution frame with filesystem materialization and session tracking
argument-hint: <goal> [--direction=down|up] [--scope=...] [--delegate=auto|never|always] [--trace=none|light|full]
---

Create a scoped, isolated execution frame that materializes as a directory tree with durable artifacts.

**Core Concept:**
- `/drill` creates isolated execution frames with narrowed scope
- Each drill is a directory with markdown file + evidence + nested `.drills/`
- `.drills/cursor` tracks current position by SHA
- Session pointers enable agent continuity and delegation

**Directory Structure:**
```
.drills/
  cursor                                    # contains current drill SHA
  2026-07-11-132105-a1b2c3-api-debug/
    2026-07-11-132105-a1b2c3-api-debug.md  # drill file
    evidence-log-snippet/                   # supporting docs
      evidence-log-snippet.md
    .drills/                                # nested drills
      2026-07-11-132530-d4e5f6-db-optim/
        2026-07-11-132530-d4e5f6-db-optim.md
```

**Naming Convention:**
`YYYY-MM-DD-HHMMSS-sha-slug`
- ISO date + compact time
- Short SHA (6-8 hex chars)
- Human-readable slug

**Command Options:**
```
/drill {
  direction: down | up,        # down=enter, up=exit (default: down)
  goal: "...",                 # immediate objective
  scope: "...",                # hard boundary (what's in/out)
  problem: "...",              # problem formulation
  delegate: auto|never|always, # can spawn subagents
  trace: none|light|full,      # how much trace to save
  merge: summary|structured|full, # how much returns upward
  evidence: link|copy|none,    # evidence handling
  slug: "..."                  # human-readable name part
}
```

**Downward Drill (direction=down):**
1. Validates scope is narrower than parent
2. Creates child directory under current `.drills/`
3. Creates drill markdown file
4. Copies only minimum necessary context
5. Updates `.drills/cursor` with new SHA
6. Starts new execution frame

**Session Block (in drill frontmatter):**
```yaml
session:
  agent_id: orchestrator
  role: orchestrator | subagent
  session_id: sess_01jz8n4x7e
  parent_session_id: null      # if delegated
  spawned_by: null             # agent that created this
  mode: direct | delegated | resumed
  resume_command: null         # how to restore session
  resume_uri: null             # URI to agent session
```

**Scope Rules:**
Child drill must narrow parent scope:
- Focus on one subsystem
- Test one hypothesis
- Inspect one artifact class
- Reduce time/environment/failure surface

Invalid: broadening, sideways pivot, new top-level objective

**Delegation Model:**
- Each subagent gets fresh, isolated context
- Receives only task description + selected materials
- No sibling contexts or full parent history
- Returns compressed result, not transcript

**Drill File Template:**
```md
---
type: drill
id: 2026-07-11-132105-a1b2c3-api-debug
parent: null
created_at: 2026-07-11T13:21:05Z
status: open
sha: a1b2c3
slug: api-debug
goal: Identify root cause of API 500 error
scope: Only /api/orders, production logs, DB latency
delegate: auto
trace: light
merge: summary
session:
  agent_id: orchestrator
  session_id: sess_01jz8n4x7e
  mode: direct
---

# Scope
# Problem Statement
# Plan
# Findings
# Evidence
# Links
# Return Payload
# Session Continuity
```

**Mental Model:**
`/drill` = isolate + descend + materialize + delegate

Must be closed with `/undrill` to reintegrate results.

Full specification: `~/.agents/skills/drill/SKILL.md`
