# Agent Memory Rule

## Overview
Agents must maintain persistent memory across sessions to improve context retention, learning, and decision-making. This rule enforces the memory protocol defined in the `memory` skill (`~/.agents/skills/memory/SKILL.md`).

## Memory Skill Integration

This rule is built on top of the **memory skill** which provides the complete implementation protocol. The memory skill defines:
- Memory backend resolution (Internal ? MCP ? Fallback)
- Core protocol (Recall ? Act ? Persist)
- Integration with retrospect skill
- Entity types and naming conventions
- Session lifecycle management

**Reference**: `~/.agents/skills/memory/SKILL.md`

## Mental Models

The memory system implements three cognitive operations aligned with the memory skill protocol:

### 1. **Recall** (Retrieval)
**Before starting any task**, search memory for prior context using the memory skill''s recall protocol:

- Extract key terms from the task (project name, file paths, feature names, error messages)
- Search memory using available backend (internal tool > MCP server > session notes)
- Apply recalled knowledge: prior decisions, known pitfalls, user preferences, incomplete work
- Treat retrospect findings as high-priority context

**Query patterns:**
- "What are the user''s coding preferences?"
- "What did we discuss about [project/feature]?"
- "What patterns does this project use?"
- "What retrospect findings exist for [component]?"

### 2. **Retain** (Encoding)
**During work**, persist significant findings immediately using the memory skill''s persistence protocol:

Store information with appropriate structure:
- **What**: The fact, preference, or knowledge (atomic and actionable)
- **When**: Timestamp of retention
- **Why**: Context or reason for remembering
- **Type**: Entity type (project, user_preference, retrospect, task, tool, decision)

**Always retain:**
- Explicit user requests ("Remember that...")
- User preferences (coding style, tools, workflows)
- Project-specific patterns and conventions
- Important decisions and their rationale
- Retrospect findings (mistakes, root causes, prevention rules)

**Never retain:**
- Temporary session data
- Sensitive information (passwords, tokens, credentials)
- Redundant or trivial facts
- Information available in documentation

### 3. **Reflect** (Consolidation)
Periodically review and consolidate memories:

- **Update existing entities** rather than creating duplicates
- **Delete outdated observations** before adding replacements
- **Detect patterns** in retrospect findings (recurring mistakes)
- **Cross-reference** related entities with relations
- **Clean up** completed tasks and obsolete data

**Reflection triggers:**
- End of significant task
- User explicitly requests reflection
- Pattern detected in retrospect findings
- Session end or task completion

## Memory Backend Priority

Follow the memory skill''s backend resolution order:

1. **Internal Memory Tool** (if available)
   - Native agent capability (`save_memory`, `recall`, `memorize`)
   - Fastest access, lowest latency
   - Use this first if available

2. **Memory MCP Server** (if configured)
   - Knowledge graph-based persistent memory
   - Tools: `search_nodes`, `create_entities`, `add_observations`, etc.
   - Structured entity and relation management

3. **Session-Scoped Fallback** (if no backend)
   - Plan files, todo lists, session notes
   - Warn user once about lack of persistent memory
   - Best-effort memory within session only

## Integration with Retrospect Skill

Memory and retrospect are tightly coupled per the memory skill protocol:

**Retrospect ? Memory (Persist):**
When `$retrospect` captures a finding, persist it to memory:
- Create/update `retrospect` entity
- Add observations: what went wrong, root cause, prevention rule
- Link to affected project/tool entities

**Memory ? Retrospect (Recall):**
During recall, treat retrospect entities as high-priority:
- Apply prevention rules immediately
- Check if current task intersects known findings
- Detect recurring patterns and escalate

## Best Practices

1. **Always recall before acting** - Check memory first, even if you think you know
2. **Persist immediately** - Don''t batch learnings to end of session
3. **Be atomic and actionable** - One fact per observation, specific and clear
4. **Update, don''t duplicate** - Search before creating new entities
5. **Respect privacy** - Never store secrets or credentials
6. **Trust code over memory** - Memory is context, code is truth
7. **Clean up regularly** - Delete outdated observations and completed tasks

## Anti-Patterns

- Starting work without checking memory (failure mode #1)
- Persisting everything (be selective - cross-session value only)
- Vague observations ("had issues" vs "API returns 401 on expired tokens")
- Duplicating entities (search first, update existing)
- Ignoring retrospect entities (highest-value memory)
- Storing sensitive data (never persist secrets/tokens)
- Treating memory as authoritative over code (always verify)

## Session Lifecycle

**Session Start:**
1. Detect memory backend (internal > MCP > fallback)
2. If task given: search memory for prior context
3. Apply recalled knowledge before beginning work

**During Work:**
1. Persist significant findings as they occur
2. Update existing entities when new information emerges
3. On retrospect trigger: persist finding immediately

**Session End:**
1. Persist any remaining unpersisted learnings
2. Update task entities with completion status
3. If incomplete: persist clear "left off at" context

## Related Skills and Rules

- **Memory Skill**: `~/.agents/skills/memory/SKILL.md` (authoritative protocol)
- **Retrospect Skill**: `~/.agents/skills/retrospect/SKILL.md` (mistake capture)
- `agent-context.md`: Context management and awareness
- `agent-learning.md`: Continuous learning and adaptation
- `agent-privacy.md`: Data privacy and security guidelines
