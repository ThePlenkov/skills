# Loop convergence — `/act --loop` stability heuristic

The four exit conditions in SKILL.md are the **only** exit rule. This
document explains how to verify conditions 3 and 4 are stable.

## The four conditions (canonical exit rule)

1. `open_threads == 0` from `review-state.ts` showing `OPEN_THREADS=0`.
2. `CI_REQUIRED_PENDING == 0`, `SAST_FINDINGS_PENDING == 0`, and
   `SAST_FINDINGS_UNKNOWN == 0`.
3. No new comments / annotations appeared in the last CI run
   (compare bot-comment count before and after the most recent push).
4. No cycle-guard signal fires on this iteration (reopened thread, same rule 2+, or empty /act loop — see SKILL.md exit conditions).

There is no second, parallel exit rule. The stability heuristic below
is a way to verify conditions 3 and 4, not an independent way to leave
the loop.

## Stability check

If the current iteration's push produced zero new bot comments AND zero
new bot findings/annotations and no new required-check failures compared
to the previous HEAD, the loop is stable for this iteration. (Compare
findings and check outcomes, not raw check-run objects — every push
spawns fresh check-run objects, so counting them would never reach
zero.) The full exit still requires conditions 1 and 2 to also hold.

In practice, three consecutive stable iterations is a strong signal
that no further bot findings are coming. But stability alone is never
sufficient — `open_threads == 0` and the CI/SAST zeros are still
required.

## Common iteration pattern

The first push resolves 80-90% of threads, the second push resolves
the bot re-evaluations on the iteration-1 fixes (the "iteration-2
catch"), the third push resolves the bot re-evaluations on the
iteration-2 fixes, and so on. Each iteration shrinks the remaining
set but typically does not zero it. A clean exit is usually 3-5
iterations, not 1.

## Context management and handoff

When the context window is approaching capacity: stop the loop,
summarize current state, write a handoff file (PR comment for PR
context; `.agents/review-debt/harvests/` or `.agents/backlog/`
entries for batch context), then report to user with "PR is at
[state]. Remaining: [list]. Recommend running `/act` again to
continue."

## Subagents for context preservation

Use subagents when the main `/act` context is getting large and you
need to perform a sub-task without consuming the orchestrator's context
window. P5 (rating) → `general` subagent; large SAST investigation →
`investigator` subagent; batch debt processing → parallel subagents
per group. The orchestrator stays lean — it fetches state, plans,
dispatches, and integrates results. Subagents do the deep work and
return status.
