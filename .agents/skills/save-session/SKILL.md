---
name: save-session
description: Perform a durable end-of-work save when the user says phrases like "сохранись", "save the session", "зафиксируй", or "сделай сейв". Use this whenever the user wants the current work preserved across code, plans, memory, and documentation instead of only a local edit.
metadata:
  tags:
    - productivity
    - workflow
    - persistence
  author: codex
  version: "1.0.0"
---

# Save Session

Interpret the user's save command as a cross-project persistence workflow, not as a single action.

## When to Use

- The user says `сохранись`.
- The user asks to save the session, preserve the work, or make a durable checkpoint.
- The user wants the current state captured across code, memory, plans, and docs.

## When NOT to Use

- The user asks only for a git commit, push, or memory save.
- The user explicitly says to skip commit, docs, or memory.
- The workspace is still exploratory and the user has not asked for a save point.

## Workflow

1. Inspect the current state before changing anything.
   Check dirty files, active plans, docs touched, and whether the work spans multiple repositories.

2. Save the human-facing state.
   Update the relevant spec, docs, plan, checklist, or notes if the completed work changed behavior, architecture, or decisions.

3. Save the learned state.
   Persist durable conclusions, preferences, and important outcomes to long-term memory. Do not store secrets.

4. Save the code state.
   If there are owned code changes worth preserving, create a commit unless the user said not to. Treat `сохранись` as explicit permission to commit the current work, but not to push.

5. Save only what belongs to the current work.
   Do not stage or commit unrelated dirty changes from the user or from other parallel work.

6. Save the operational context.
   In the final response, summarize what was saved, what was intentionally not saved, and any remaining risks or test gaps.

## Commit Rules

- A save command authorizes a local commit.
- A save command does not authorize `git push`, merge, branch deletion, or destructive cleanup.
- If multiple repositories are involved, save each repository independently and say which ones were persisted.
- If there is nothing meaningful to commit, still save docs, plans, and memory when applicable, and say that no commit was created.

## Output

Report the save result in this order:

1. What was persisted.
2. Whether a commit was created.
3. What remains unsaved or intentionally deferred.
