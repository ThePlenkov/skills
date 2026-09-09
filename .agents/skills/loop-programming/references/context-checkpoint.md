# Context Checkpoint (pre-compaction)

Before context compaction, preserve a checkpoint containing the active
loop state. Save to disk (e.g. `tmp/loop-<id>.yaml`) so the next agent
can resume without re-deriving the loop contract from scratch.

```yaml
goal:
success_criteria:
current_state:
current_hypothesis:
changed_files:
validators:
iteration:
remaining_limits:
known_failures:
next_action:
```

## What to capture

- `goal` and `success_criteria` — the loop contract, verbatim.
- `current_state` and `current_hypothesis` — the last-known snapshot
  before the compaction. Don't summarize the work; record what the
  loop is currently looking at.
- `changed_files` — every file the loop has touched in this run, in
  order. The next agent will diff against this list.
- `validators` — the commands run so far, with their last exit codes
  and any captured output excerpts.
- `iteration` — current iteration count, stagnation counter, remaining
  budget (`max_iterations - used`, `timeout_seconds - elapsed`).
- `known_failures` — what has been tried and didn't work, so the
  next agent doesn't re-run it.
- `next_action` — the single next step the loop planned to take.

## When to write it

- Before any tool call that may trigger context compaction.
- Before handing the loop off to a subagent.
- When the loop approaches `stagnation_limit` so the next agent has
  context even if the user intervenes.

Resume safety: a checkpoint that can be re-loaded and run from
`next_action` with the same `remaining_limits` is `resume_safe: true`;
anything that requires a human decision is `resume_safe: false`.
