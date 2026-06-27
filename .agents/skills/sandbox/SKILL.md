---
name: sandbox
description: Isolate risky agent experiments in a dedicated git branch or git worktree, create explicit checkpoint commits, and prevent the agent from breaking the user's active working directory. Use before architecture experiments, dependency changes, framework rewrites, config changes, large refactors, generated-file changes, migration attempts, or any task where the agent may need to try multiple approaches.
argument-hint: "[optional experiment name or root objective]"
triggers:
  - user
allowed-tools:
  - read
  - grep
  - glob
  - exec
  - edit
  - write
permissions:
  allow:
    - Read(*)
    - Grep(*)
    - Glob(*)
    - Exec(git rev-parse --show-toplevel)
    - Exec(git status --short)
    - Exec(git status --porcelain=v1)
    - Exec(git branch --show-current)
    - Exec(git worktree list)
    - Exec(git worktree add *)
    - Exec(git switch -c agent/*)
    - Exec(git add *)
    - Exec(git commit *)
    - Exec(git diff)
    - Exec(git diff --stat)
    - Exec(git diff --binary)
    - Exec(git diff --cached --binary)
    - Exec(git ls-files --others --exclude-standard)
    - Exec(mkdir -p *)
    - Exec(tar *)
    - Exec(cp *)
    - Exec(*test*)
    - Exec(*lint*)
    - Exec(*typecheck*)
  deny:
    - Exec(git reset --hard)
    - Exec(git clean *)
    - Exec(git restore .)
    - Exec(rm -rf *)
---

# SANDBOX MODE

The agent must not perform risky experiments directly in the user's active working tree.

A risky experiment includes:

- changing build config
- changing Vite, Nx, TanStack, webpack, tsconfig, package manager config
- dependency installation or removal
- architecture spike
- framework integration attempt
- route generation
- code generation
- migration
- large refactor
- deleting files
- moving files
- replacing node-pty, WebSocket, server runtime, routing, bundling, or transport logic
- any fix where failure may leave the project broken

Core rule:

**Do not experiment in place.**
**Create an isolated agent sandbox.**
**Checkpoint often.**
**Only integrate proven work back into the main tree.**

## Required procedure

1. Inspect repository state.

Run:

git rev-parse --show-toplevel
git branch --show-current
git status --short
git worktree list

If this is a nested repository, inspect the nested repository separately.

1. If the current working tree is dirty, protect it first.

Dirty tree means:

- modified tracked files
- staged changes
- untracked files

Do not assume these are agent changes.
Do not overwrite them.
Do not clean them.
Do not restore them.

Create a rescue checkpoint before doing anything else:

- save git status
- save tracked diff as binary patch
- save staged diff as binary patch
- save untracked file list
- archive untracked files

If user work and agent work are mixed, stop and ask before moving or reverting anything.

1. Create an agent sandbox.

Preferred approach:

Use git worktree.

Example shape:

../<repo-name>.agent-<short-task>-<timestamp>/

Branch shape:

agent/<short-task>-<timestamp>

The sandbox must be separate from the user's active worktree.

If git worktree is unavailable, use a dedicated branch in the current repository only after preserving the current state.

1. Move risky work into the sandbox.

From this point onward:

- edits happen in the sandbox
- tests run in the sandbox
- dev servers run in the sandbox
- generated files are created in the sandbox
- broken experiments stay in the sandbox

The original working tree should remain stable.

1. Create checkpoint commits.

Checkpoint commits are required at these moments:

- before the first risky edit, if there are preparatory changes
- after reproducing the failure
- after a working narrow fix
- before a large movement/refactor
- after runtime proof passes
- before integrating back to the main working tree

Checkpoint commit message format:

agent checkpoint: <short task> - <state>

Examples:

agent checkpoint: console websocket - reproduce vite failure
agent checkpoint: console websocket - tmux transport working
agent checkpoint: console websocket - browser proof passes

Checkpoint commits must stay on agent/* branches unless the user explicitly approves integration.

1. Failed experiments stay isolated.

If an experiment fails:

- do not repair the user's active tree
- do not run git restore . in the user's tree
- do not run git clean
- preserve the failed sandbox if useful
- report the branch/worktree path and failure evidence

1. Successful experiments are integrated deliberately.

Before integration:

- show git diff --stat
- show changed files
- explain what is proven
- explain what remains unproven
- run targeted verification
- run runtime/browser verification if frontend behavior is involved

Integration options:

- cherry-pick selected commits
- apply selected patch
- merge the agent branch
- manually port the minimal proven diff

Do not integrate broken checkpoint commits.
Do not integrate unrelated experiments.
Do not integrate without verifying in the target context.

1. If the user says "continue", continue in the sandbox unless they explicitly request integration.

2. If the user says "/unwind", fold the proven sandbox state into the mainline plan and proceed with the next parent-level action.

3. If the user says "undo", "you broke it", or "restore", trigger safeguard or salvage first.

## CHECKPOINT COMMAND

When the user says /checkpoint:

- confirm current branch is agent/*
- inspect git status
- summarize changed files
- run or cite the latest verification
- git add only relevant files
- git commit with message:
  agent checkpoint: <task> - <state>
- report commit hash

Do not checkpoint on main.
Do not include unrelated user files.
Do not checkpoint secrets, logs, node_modules, dist, or huge generated artifacts unless explicitly required.

## Forbidden behavior

- Do not experiment directly on main.
- Do not use the user's active tree as scratch space.
- Do not leave the project broken between experiments.
- Do not rely on uncommitted changes as memory.
- Do not say "I can revert later" without a checkpoint.
- Do not run git clean to fix an experiment.
- Do not run git restore . as an apology.
- Do not make checkpoint commits on main unless explicitly requested.
- Do not commit user work into an agent checkpoint without explicit approval.
- Do not mix multiple hypotheses in one checkpoint commit.

## Output format

[SANDBOX TRIGGERED]
Reason:
Risk level:
Current repo:
Current branch:
Current status:

[PROTECTION]
Dirty tree: yes/no
Rescue checkpoint: path or not needed
User work at risk: yes/no/unknown

[SANDBOX CREATED]
Worktree:
Branch:
Purpose:

[PLAN]
Experiment objective:
Checkpoint points:
Verification method:

[PROCEEDING]
Next action:
Expected proof:
