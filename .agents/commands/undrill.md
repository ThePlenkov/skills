---
description: Close drill frame and reintegrate results - upward traversal with session restoration
argument-hint: --merge=summary|structured|full --trace=none|light|full --conflicts=resolve|surface|ignore
---

Close current drill frame and safely reintegrate results into parent context. Alias for `/drill { direction = up }`.

**Core Concept:**
- Closes execution frame opened by `/drill`
- Updates `.drills/cursor` to parent SHA
- Restores parent agent session
- Propagates only curated outputs upward

**Equivalent Forms:**
```
/undrill
/drill { direction = up }
/drill { direction = up, merge=summary, trace=light }
```

**Upward Drill Operations:**
1. Finalizes current drill file
2. Compresses findings into parent-consumable result
3. Links important evidence and artifacts
4. Propagates only selected outputs (not full child history)
5. Reads drill's `parent` from frontmatter
6. Rewrites `.drills/cursor` with parent's SHA
7. Returns control to parent frame/session

**Merge Policies:**
- `summary` (default) - Distilled insights only, one concise finding set
- `structured` - Machine-readable output with typed fields
- `full` - Extensive notes and trace references (debug mode)

**Structured Output Example:**
```json
{
  "result": "...",
  "insights": [...],
  "artifacts": [...],
  "confidence": 0.87,
  "evidence": [...],
  "next_step": "..."
}
```

**Trace Handling:**
- `none` - Discard reasoning beyond final findings
- `light` (default) - Key steps, tool actions, hypothesis changes
- `full` - Exhaustive debugging trace and artifact trail

**Context Reintegration:**
- Injects results into parent frame
- Does NOT reintroduce full child context
- Only outputs pass upward (default)
- Controlled leak: allow selected intermediate artifacts (opt-in)

**Leak Control (prevents context poisoning):**
- `none` (default) - Only outputs pass upward
- `controlled` - Allow selected intermediate artifacts

Prevents:
- Irrelevant chain-of-thought bleed
- Noisy context accumulation
- Cross-task contamination

**Conflict Resolution:**
If outputs contradict parent assumptions:
- `resolve` - Attempt auto-reconciliation
- `surface` - Flag explicitly for user
- `ignore` - Pass through

**Return Payload Contract:**
Each child drill must define:
- Short answer
- Confidence/certainty level
- Evidence links
- Open questions
- Recommended next action

**State Transitions:**
- `open` → `done` (successful completion)
- `open` → `abandoned` (intentional stop without full resolution)
- `open` → `blocked` (cannot proceed, needs escalation)

**Session Restoration:**
When undrilling:
1. Read current drill's `session.parent_session_id`
2. Restore parent agent session context
3. Resume parent's execution frame
4. Parent receives compressed child result, not transcript

**Cursor Management:**
```
Before:  .drills/cursor contains child SHA (d4e5f6)
After:   .drills/cursor contains parent SHA (a1b2c3)
```

**Validation:**
Before moving upward, verify:
- Current drill exists and is active
- Findings or status are written
- Return payload present (unless abandoned)
- Evidence links resolve or marked missing
- Not at root (unless root-close mode allowed)

**Example:**
```
/undrill --merge=structured --trace=light --conflicts=surface
```

**Stack Example:**
```
Root (a1b2c3)
 └── /drill (debug API issue)
      └── /drill (inspect logs - d4e5f6) ← current
      └── /undrill → back to (a1b2c3)
```

**Mental Model:**
`/undrill` = finalize + extract + compress + restore parent session

Full specification: `.agents/skills/drill/SKILL.md`
