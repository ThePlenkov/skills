---
name: git-commit
description: Create git commits on request. Use when the user asks for a /commit command, to commit current changes, or to prepare a commit message from the working tree.
---

# Git Commit

## Workflow

1. Inspect the repo state:
   - `git status -sb`
   - `git diff --stat`
2. Decide what to stage:
   - If only tracked files changed, stage all with `git add -A`.
   - If untracked files exist, ask before staging them.
   - Never stage secrets or generated artifacts; respect `.gitignore`.
3. Draft a concise commit message from the diff:
   - Prefer `type: summary` or short imperative (e.g., "fix: handle empty token").
4. Commit:
   - `git commit -m "message"`
5. Report the commit hash and a short summary.

## Notes

- If nothing to commit, say so and stop.
- If changes are large or unclear, summarize and ask for confirmation before committing.
