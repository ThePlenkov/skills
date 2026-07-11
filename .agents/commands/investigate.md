---
description: Investigate and narrow scope before editing - produce evidence for targeted patch
argument-hint: <bug, file, feature, failing command, or investigation target>
---

Use before editing when bug, task, or code area is not yet understood. Narrow scope through investigation.

**Goal:** Produce enough evidence for a narrow patch plan.

**DO NOT EDIT during this skill** - investigation only.

**Procedure:**

1. **Define investigation target** from arguments

2. **Search before reading:**
   - Exact error strings
   - Named functions/classes/components
   - Route paths
   - Failing test names
   - Config keys
   - Filenames

3. **Read only most relevant files**

4. **Trace smallest runtime path** that could explain issue

5. **Reproduce failure** with targeted command (if practical)

6. **Separate facts from hypotheses**

7. **Apply minimal-root-cause** analysis before recommending fix

8. **End with one recommended next action**

**Required output:**
- Investigation target
- Evidence found
- Likely cause
- Files relevant to patch
- Suggested next step
- Commands run
- Uncertainty

**Stop if:**
- Required files inaccessible
- Reproduction needs unavailable secrets/services
- Evidence points to multiple unrelated causes
- Next step would be editing without clear target

**Allowed tools:** read, grep, glob, exec (no editing)

Apply the full investigate-first protocol from `~/.agents/skills/investigate-first/SKILL.md`.
