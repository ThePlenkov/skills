---
description: Search memory for prior context before starting work
argument-hint: <search-terms>
skill: persistent-memory
---

Search memory for prior context, decisions, and learnings before starting any task.

**What to search for:**
- Project or repository name
- Key file paths or component names
- Error messages or bug descriptions
- Tool or library names
- User preferences

**How to use results:**
- Prior decisions → apply them, don't re-debate
- Known pitfalls → avoid them proactively
- User preferences → follow without asking
- Incomplete work → pick up where it left off
- Retrospect findings → apply immediately (highest priority)

**Backend priority:**
1. Internal memory tool (if available)
2. Memory MCP server (search_nodes, open_nodes)
3. Session notes (fallback)

**Opt-in by design (Tier 1)** — recall is NOT always-on. Invoke explicitly at task start when cross-session context may matter. For trivial tasks (typo fix, single-line change, quick question), skip this command.

Apply the recall protocol from `$skill{persistent-memory}`.
