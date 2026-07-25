---
description: Close drill frame, reintegrate results, and emit a parallel prevention plan
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
2. Produces a `prevention_plan` (empty array if no actions; populated when the drill found an error, gap, or reusable lesson)
3. Compresses findings and the prevention plan into a parent-consumable result
4. Links important evidence and artifacts
5. If this drill has a parent:
   - Propagates `prevention_plan` and selected outputs upward (not full child history)
   - Reads drill's `parent` from frontmatter
   - Rewrites `.drills/cursor` with parent's SHA
   - Returns control to parent frame/session
6. If this drill is the root:
   - Finalizes `.drills/cursor` in a terminal state (root SHA)
   - Skips parent restoration
   - Triggers the **post-drill phase** once

**Merge Policies:**
- `summary` (default) - Distilled insights only, one concise finding set
- `structured` - Machine-readable output with typed fields
- `full` - Extensive notes and trace references (debug mode)

**Structured Output Example:**
```json
{
  "answer": "...",
  "insights": [...],
  "artifacts": [...],
  "confidence": 0.87,
  "evidence": [...],
  "next_step": "...",
  "prevention_plan": [
    {
      "action": "Open upstream issue for the failing dependency",
      "scope": "project",
      "sink": "upstream-issue",
      "owner": "parent agent",
      "evidence": ["./findings.md"]
    }
  ]
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
- `prevention_plan` with parallel actions when the drill found an error, gap, or reusable lesson

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
- `prevention_plan` present (may be empty)
- Return payload present (unless abandoned)
- Evidence links resolve or marked missing
- Root `/undrill` is valid and triggers the post-drill phase once; non-root `/undrill` restores the parent frame

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

Non-root `/undrill` propagates `prevention_plan` upward for merging. Root `/undrill` triggers the **post-drill phase** once, where the topmost parent merges all plans and invokes `$skill{retrospect}` to route actions to the correct resources.

Full specification: `skills/safety/drill/SKILL.md`
