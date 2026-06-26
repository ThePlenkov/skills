---
name: salvage
description: Emergency recovery mode after accidental deletion, git clean, git restore, reset, overwrite, or destructive agent action. Use when user work may have been lost. The goal is to stop further damage, preserve current disk state, inspect recovery sources, and report what can and cannot be recovered.
argument-hint: "[optional lost file or directory]"
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
    - Exec(git reflog *)
    - Exec(git fsck *)
    - Exec(git stash list)
    - Exec(git log *)
    - Exec(git show *)
    - Exec(git diff *)
    - Exec(find *)
    - Exec(mkdir -p *)
    - Exec(cp *)
    - Exec(tar *)
  deny:
    - Exec(git clean *)
    - Exec(git reset --hard)
    - Exec(git restore .)
    - Exec(rm -rf *)
    - Exec(find * -delete)
---

# SALVAGE MODE

A destructive action may have deleted or overwritten work.

Your goal is damage control, not normal progress.

Do not run cleanup.
Do not run git clean.
Do not run git reset --hard.
Do not run git gc.
Do not install dependencies.
Do not format files.
Do not keep developing.

## Immediate steps

1. Stop mutating processes.

Kill dev servers, watchers, generators, or scripts that might overwrite more files.

2. Preserve current state.

Create a salvage checkpoint:

../.agent-salvage/YYYYMMDD-HHMMSS/

Save:

- git status --short
- git diff --binary
- git diff --cached --binary
- list of current untracked files
- archive of current untracked files if any

3. Determine what happened.

Inspect recent commands from conversation/logs.

Classify damage:

- tracked modifications discarded
- untracked files deleted
- staged changes lost
- committed work reverted
- generated files removed
- nested repository affected

4. Check recovery sources.

Use only non-destructive reads:

- git stash list
- git reflog
- git log --all --stat
- git fsck --lost-found only if needed
- IDE local history if user can access it
- editor backups
- test-results or generated artifacts
- shell scrollback or command logs
- previous assistant messages containing file contents
- package manager or framework regeneration commands, only after preservation

5. Be honest.

Tracked committed files can usually be restored.
Tracked uncommitted changes may be recoverable only from patches, stash, IDE local history, or object database if they were staged.
Untracked files deleted by git clean are often not recoverable by Git unless they were staged, stashed, copied, committed, or saved by IDE/filesystem backup.

6. Do not claim recovery unless a file is actually restored and inspected.

## Output format

[SALVAGE MODE]
Incident:
Last destructive command:
Damage class:

[PRESERVED CURRENT STATE]
Checkpoint path:
Files saved:

[RECOVERY SOURCES CHECKED]
- Source:
  Result:

[RECOVERABLE]
Files:
Method:

[LIKELY LOST]
Files:
Reason:

[NEXT SAFE ACTION]
One action:
Approval needed:
