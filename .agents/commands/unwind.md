---
description: Collapse solved branch into main plan, rebuild from proven state, continue automatically
argument-hint: optional root objective or direction
---

Collapse a completed narrow branch into the parent/root task, rebuild execution plan from proven state, and continue automatically.

**When to use:**
- Subtask, spike, blocker, or investigation is resolved
- Need to integrate result into main plan
- Ready to proceed with next parent-level action

**Required procedure:**

1. **Collapse solved branch**
   - Completed branch summary
   - Proven facts
   - Files changed
   - Runtime evidence
   - New baseline

2. **Convert evidence into plan constraints**
   - Assume true going forward
   - Do not revisit unless contradicted
   - Still unproven items
   - Risks

3. **Rebuild parent/root plan**
   - Short plan with 3-6 concrete steps
   - Based on current proven state, not old assumptions
   - Do not include completed work as future work

4. **Select next best action**
   - Action to take
   - Reason for selection
   - Expected proof

5. **Proceed immediately**
   - Use available tools directly
   - Launch subagents with run_subagent when needed
   - Use @skills:subagent-capsule before launching subagents

**Stop only if:**
- Required filesystem access missing
- Next action is destructive
- Root objective unknowable
- Verification requires unavailable credentials
- Would violate explicit user constraints

**Never:**
- Present "Would you like to..." menu unless truly blocked
- Restart whole task from scratch
- Keep polishing completed branch
- Undo working code
- Claim root task solved when only branch is solved

Apply the full unwind protocol from `.agents/skills/unwind/SKILL.md`.
