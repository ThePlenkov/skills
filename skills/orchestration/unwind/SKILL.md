---
name: unwind
description: Collapse a solved narrow branch into the parent/root task, rebuild the execution plan from the new proven state, and continue automatically. Use when a subtask, architecture spike, blocker, or investigation is resolved and the agent must stop asking what to do next, integrate the result into the main plan, and proceed with the next best parent-level action.
argument-hint: "[optional root objective or direction]"
triggers:
  - user
allowed-tools:
  - read
  - grep
  - glob
  - exec
  - edit
  - write
  - run_subagent
permissions:
  allow:
    - Read(*)
    - Grep(*)
    - Glob(*)
    - Exec(git status --short)
    - Exec(git diff --stat)
    - Exec(git diff)
    - Exec(*test*)
    - Exec(*lint*)
    - Exec(*typecheck*)
    - run_subagent
  deny: []
source: ThePlenkov/skills
---

# UNWIND MODE

The user is not asking for a passive session summary.

The user is not asking for options.

The user is not asking to revert files.

The user is asking you to collapse the completed narrow branch into the main execution plan, rebuild the plan from current evidence, and continue.

Meaning:

- Preserve the working solution.
- Treat proven facts as new baseline.
- Stop optimizing the solved branch.
- Return to the parent/root objective.
- Replan using the current repository state.
- Pick the next best action yourself.
- Proceed unless blocked by missing permission, destructive risk, or unclear root objective.

If the user provides arguments, use them as the root objective or direction:

$ARGUMENTS

If no arguments are provided, infer the root objective from conversation history, AGENTS.md, todos, recent file changes, and verification evidence.

If the root objective cannot be inferred, ask one direct question and stop.

## Required procedure

1. Collapse the solved branch.

Write:

[UNWOUND BRANCH]
Completed branch:
Proven facts:
Files changed:
Runtime evidence:
What is now baseline:

1. Convert evidence into plan constraints.

Write:

[NEW BASELINE]
Assume true going forward:
Do not revisit unless contradicted:
Still unproven:
Risks:

1. Rebuild the parent/root plan.

Write a short plan with 3 to 6 concrete steps.

The plan must be based on the current proven state, not the old assumptions.

Do not include completed work as future work.

Do not ask the user to choose between obvious next steps.

1. Select the next best action.

Write:

[NEXT ACTION SELECTED]
Action:
Reason:
Expected proof:

1. Proceed.

Immediately perform the next best action using available tools.

This includes:

- Direct tool usage (read, grep, edit, exec, etc.)
- Launching subagents with run_subagent when the next action is best handled by investigator, patcher, or verifier
- Using @skills:subagent-capsule before launching any subagent

Do not stop after listing options.

Stop only if:

- required filesystem access is missing
- the next action is destructive
- the root objective is genuinely unknowable
- verification requires credentials or external state the agent does not have
- continuing would violate explicit user constraints

## Forbidden behavior

- Do not output "Would you like to..." unless truly blocked.
- Do not present a menu of options when one next action is clearly best.
- Do not restart the whole task from scratch.
- Do not keep polishing the completed narrow branch.
- Do not undo working code.
- Do not claim the root task is solved just because the branch is solved.
- Do not use curl as final proof for frontend/browser behavior.
- Do not hesitate to launch subagents when the next action requires investigator, patcher, or verifier profiles.

## Output format

[UNWOUND BRANCH]
Completed branch:
Proven facts:
Runtime evidence:
New baseline:

[REPLANNED]
Root objective:
Current parent status:
Plan:
1.
2.
3.

[NEXT ACTION SELECTED]
Action:
Reason:
Expected proof:

[PROCEEDING]
Tool/action (or subagent launch):
Result:
Next verification:
