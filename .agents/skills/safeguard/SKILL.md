---
name: safeguard
description: Prevent destructive agent actions from deleting user work, untracked files, experimental code, or recoverable evidence. Use before any rollback, cleanup, restore, reset, delete, git clean, git restore, git reset, rm, overwrite, mass edit, or dependency cleanup. This is a cross-agent safety skill: investigator, patcher, verifier, and any subagent must obey it before destructive commands.
argument-hint: "[optional reason for destructive action]"
triggers:
  - user
allowed-tools:
  - read
  - grep
  - glob
  - exec
  - write
permissions:
  allow:
    - Read(*)
    - Grep(*)
    - Glob(*)
    - Exec(git status --short)
    - Exec(git status --porcelain=v1)
    - Exec(git diff --binary)
    - Exec(git diff --cached --binary)
    - Exec(git diff --stat)
    - Exec(git ls-files --others --exclude-standard)
    - Exec(mkdir -p *)
    - Exec(cp *)
    - Exec(tar *)
  deny:
    - Exec(git restore .)
    - Exec(git checkout .)
    - Exec(git reset --hard)
    - Exec(git clean *)
    - Exec(rm -rf *)
    - Exec(find * -delete)
    - Exec(xargs rm *)
    - Exec(truncate *)
---

# SAFEGUARD MODE

You are not allowed to destroy or discard repository state until you have preserved it and received explicit approval.

This skill applies before any command or edit that can remove, overwrite, reset, clean, discard, or mass-change files.

Dangerous examples:

- git restore .
- git checkout .
- git reset --hard
- git clean -fd
- git clean -fdx
- rm -rf
- find ... -delete
- overwriting existing files with write
- mass formatting
- deleting generated-looking files without proving they are safe
- removing untracked files
- reverting all changes because the agent made a mistake

Core rule:

**Preserve first.**
**Explain second.**
**Ask third.**
**Destroy only after explicit approval.**

If the user says "you broke it", "undo your changes", "revert", "go back", or "restore working state":

Do not immediately run git restore, git reset, or git clean.

Instead, perform the safeguard procedure.

## SAFEGUARD PROCEDURE

1. Stop active mutation.

If a dev server, watcher, or script is still running and may continue modifying files, stop it safely.

1. Inspect repository state.

Run:

git status --short

If inside a nested repo, inspect both parent and nested repo before changing anything.

1. Create a rescue checkpoint outside the repository or in a clearly named checkpoint folder.

Preferred checkpoint directory:

../.agent-checkpoints/YYYYMMDD-HHMMSS-REASON/

If outside-repo creation is not possible, use:

.agent-checkpoints/YYYYMMDD-HHMMSS-REASON/

1. Save tracked changes.

Run:

git diff --binary > CHECKPOINT_DIR/tracked.patch

Run:

git diff --cached --binary > CHECKPOINT_DIR/staged.patch

1. Save status.

Run:

git status --porcelain=v1 > CHECKPOINT_DIR/status.txt

Run:

git status --short > CHECKPOINT_DIR/status-short.txt

1. Save untracked file list.

Run:

git ls-files --others --exclude-standard > CHECKPOINT_DIR/untracked-files.txt

1. Save untracked files.

If untracked files exist, archive them before any clean/delete command.

Preferred:

tar -czf CHECKPOINT_DIR/untracked-files.tgz -T CHECKPOINT_DIR/untracked-files.txt

If tar with list fails due paths or spaces, use a safer null-delimited method if available.

1. Report the checkpoint.

Output:

[SAFEGUARD CHECKPOINT]
Checkpoint path:
Tracked patch:
Staged patch:
Untracked archive:
Status file:
Files at risk:

1. Ask for explicit approval.

Do not continue with destructive action until the user approves.

Required approval wording:

"I preserved the current state. May I revert only the agent-created changes listed below?"

1. If approved, revert only the approved scope.

Prefer targeted restore:

git restore path/to/file

Never use broad commands unless explicitly approved:

- git restore .
- git reset --hard
- git clean -fd

1. After revert, verify.

Run:

git status --short

Then run the smallest command that proves the project is back to the intended state.

## FORBIDDEN BEHAVIOR

Do not run git clean before archiving untracked files.

Do not run git restore . just because the user is angry.

Do not assume all untracked files are disposable.

Do not delete generated-looking files unless you have proven they are generated and approved for deletion.

Do not hide destructive commands inside "cleanup".

Do not call the task resolved after deleting evidence.

Do not revert user work together with agent work.

Do not use "working tree clean" as proof that the project is fixed. It may only prove that data was deleted.

## OUTPUT FORMAT

[SAFEGUARD TRIGGERED]
Reason:
Dangerous action requested or considered:
Why safeguard is required:

[CURRENT STATE]
Repository:
Status:
Tracked modified files:
Untracked files:
Nested repos checked:

[CHECKPOINT CREATED]
Path:
Tracked patch:
Staged patch:
Untracked archive:
Status files:

[PROPOSED DESTRUCTIVE ACTION]
Action:
Exact command:
Files affected:
Why it is needed:
Safer alternative:

[APPROVAL REQUIRED]
Question:
