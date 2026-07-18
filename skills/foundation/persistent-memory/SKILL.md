---
name: persistent-memory
description: "Persistent memory enforcement for AI agents. Recall prior work and findings before starting a task; persist learnings after completing work. Tier 1 — opt-in via `/recall <terms>` at task start and `/retain <learning>` or `/reflect` when work concludes. NOT always-on; do not auto-load for every interaction."
tier: 1
triggers: [user]
---

# Memory Skill

## Why This Exists

Agents lose all context between sessions. Every session starts from zero — the same mistakes get repeated, the same explorations get re-run, the same decisions get re-debated. This is a massive waste of tokens and user patience.

This skill makes the agent **remember**: it checks what it already knows before acting, and persists what it learns before finishing. Memory is not optional — it is the foundation that makes every other skill more effective across sessions.

---

## Memory Backend Resolution

The agent must use the best available memory backend, resolved in this order:

### Priority 1: Internal Memory Tool

If the agent runtime provides a built-in memory tool (e.g., `memory`, `memorize`, `remember`, `save_memory`, `recall`), **use it**. This is the highest-priority backend because it is native, low-latency, and maintained by the agent platform.

**Detection**: At session start, check available tools for any memory-related capability. Common names: `memory`, `memorize`, `remember`, `recall`, `save_memory`, `search_memory`, `knowledge_base`.

### Priority 2: Memory MCP Server

If no internal memory tool exists, use the **Memory MCP server** (`mcp/memory` — knowledge graph-based persistent memory).

**Detection**: Check configured MCP servers for a `memory` server. If present, the following tools are available:

| Tool | Purpose |
|------|---------|
| `search_nodes` | Search memory by query (name, type, observation content) |
| `open_nodes` | Retrieve specific entities by name |
| `read_graph` | Read the full knowledge graph |
| `create_entities` | Create new knowledge entities |
| `create_relations` | Link entities together |
| `add_observations` | Add observations to existing entities |
| `delete_entities` | Remove obsolete entities |
| `delete_observations` | Remove outdated observations |
| `delete_relations` | Remove outdated relations |

**Setup reference** (for MCP configuration):

```json
{
  "<server-name>": {
    "image": "mcp/<server-name>",
    "mount": "<absolute-path-on-host>:<path-inside-container>"
  }
}
```

The above is a generic shape — substitute `<server-name>` with the
MCP server you want (e.g. `memory`) and `<absolute-path-on-host>`
with a host directory the server should persist data into. The host
runtime applies the substitution when wiring MCP into its config;
this skill does not run the server itself.

### Priority 3: No Memory Available

If neither backend is available, **warn the user once** at session start:

> "No persistent memory backend detected. Learnings from this session will not be retained. Consider configuring the Memory MCP server (`mcp/memory`) for cross-session knowledge retention."

Then fall back to session-scoped notes (plan files, todo lists) as best-effort memory.

---

## Core Protocol

### 1. Recall Before Acting

**Once `/recall` has loaded this skill for the current task**, search memory for prior context before acting:

1. **Extract key terms** from the task — project name, file paths, feature names, error messages, tool names
2. **Search memory** using those terms
3. **If results found**: read them, apply prior learnings, skip already-completed exploration
4. **If no results**: proceed normally, but flag this as a fresh area to persist later

While this skill is loaded, recall is non-negotiable for the current task. Skipping recall means potentially repeating work that was already done.

#### What to search for

- The project or repository name
- Key file paths or component names mentioned in the task
- Error messages or bug descriptions
- Tool or library names being used
- The user's name or preferences (if known)

#### How to use recall results

- **Prior decisions** → apply them, don't re-debate
- **Known pitfalls** → avoid them proactively
- **User preferences** → apply them automatically per established preferences
- **Incomplete work** → pick up where it left off
- **Retrospect findings** → critical, apply immediately (see integration below)

### 2. Persist After Learning

When the agent discovers something worth remembering, persist it **immediately** — don't batch it to end-of-session where it might be forgotten.

#### What to persist

| Category | Examples | Entity Type |
|----------|----------|-------------|
| **Project knowledge** | Build commands, test commands, architecture decisions | `project` |
| **User preferences** | Code style, communication preferences, tool choices | `user_preference` |
| **Retrospect findings** | Mistakes made, root causes, prevention rules | `retrospect` |
| **Task context** | What was done, what's left, blockers encountered | `task` |
| **Tool/library knowledge** | Quirks, workarounds, version-specific behavior | `tool` |
| **Decisions** | Why X was chosen over Y, trade-offs considered | `decision` |

#### Entity naming convention (for MCP knowledge graph)

- Use descriptive, searchable names: `project:myapp:build-commands`, `user:preferences:code-style`, `retrospect:myapp:api-auth-bug`
- Prefix with category for easy filtering
- Include project context when project-specific

#### Observation format

Keep observations **atomic and actionable** — one fact per observation, not paragraphs:

- Good: `"Build requires Node 20+, fails silently on Node 18"`
- Bad: `"The build system is complex and has many requirements including Node version constraints among other things..."`

### 3. Update, Don't Duplicate

Before creating a new entity, search for existing ones on the same topic. **Update existing entities** with new observations rather than creating duplicates.

If an observation is outdated, delete it before adding the replacement.

---

## Integration with $retrospect

Memory and retrospect are **tightly coupled**. Retrospect identifies what went wrong; memory ensures the learning survives across sessions.

### Retrospect → Memory (Persist)

When $retrospect captures a finding (steps 3–4 of the retrospect protocol), the agent **must also persist it to memory** regardless of which other persistence mechanism retrospect chooses:

1. Create or update a `retrospect` entity for the finding
2. Add observations covering: what went wrong, root cause, prevention rule
3. Create relations linking the retrospect entity to affected project/tool entities

This ensures that even if the skill file or AGENTS.md isn't present in a future session, the agent's memory still carries the learning.

### Memory → Retrospect (Recall)

During the recall phase (before starting work), if retrospect entities are found:

1. **Treat them as high-priority context** — these are past mistakes, not optional reading
2. **Apply prevention rules immediately** — don't wait to encounter the same problem
3. **Check if the current task intersects** with any known retrospect findings

### Pattern Detection

When persisting a retrospect finding, check memory for **similar prior findings**. If a pattern emerges (same type of mistake recurring), escalate:

- Create a relation: `retrospect:X -- "recurring_pattern" --> retrospect:Y`
- Add an observation to the pattern: `"This is the Nth time this type of error occurred — consider a structural fix"`
- Surface the pattern to the user

---

## Session Lifecycle

### Session Start

```
1. Detect memory backend (internal tool > MCP server > none)
2. If a task is given: search memory for prior context
3. Apply any recalled knowledge before beginning work
```

### During Work

```
1. Persist significant findings as they occur (don't batch)
2. Update existing entities when new information emerges
3. On retrospect trigger: persist finding to memory immediately
```

### Session End (or task completion)

```
1. Persist any remaining unpersisted learnings
2. Update task entities with completion status and outcomes
3. If work is incomplete: persist clear "left off at" context
```

---

## Anti-Patterns

- **Starting work without checking memory** — this is the #1 failure mode; always recall first
- **Persisting everything** — memory is for cross-session value, not a session log; be selective
- **Vague observations** — "had some issues with the API" is useless; be specific and actionable
- **Duplicating entities** — search before creating; update existing entities
- **Ignoring retrospect entities** — these represent past mistakes and are the highest-value memory
- **Persisting sensitive data** — never store secrets, keys, tokens, or credentials in memory
- **Treating memory as authoritative over code** — memory supplements code reading, never replaces it; always verify against the actual codebase

---

## What NOT to Do

- **Never skip recall** — even if you think you know the answer, check memory first
- **Never persist without structure** — use entity types, clear names, atomic observations
- **Never ignore Memory MCP when internal tool is absent** — the fallback exists for a reason
- **Never store secrets or credentials** in memory
- **Never trust memory over current code state** — memory is context, code is truth
- **Never let memory grow unbounded** — delete outdated observations, clean up completed tasks
