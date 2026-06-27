---
name: codehome
description: "Detect and fix code that works but lives in the wrong architectural layer, file, or configuration surface. Use when an agent has placed large runtime logic inside config files, route files, components, scripts, tests, temporary folders, or other inappropriate homes. This skill is cross-agent: investigator, patcher, and verifier must all use it when reviewing implementation placement, not just correctness."
argument-hint: "[optional file, feature, or concern]"
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
    - Exec(git status --short)
    - Exec(git diff --stat)
    - Exec(git diff)
    - Exec(*test*)
    - Exec(*lint*)
    - Exec(*typecheck*)
  deny: []
---

# CODEHOME MODE

The goal is not only to make the code work.

The goal is to ensure the code lives in the correct architectural home.

A working implementation in the wrong file is not resolved.
A passing test with misplaced architecture is not resolved.
Runtime proof proves behavior, not maintainability or placement.

Core rule:

**Working is necessary.**
**Correct home is also necessary.**

Use this skill when:

- a config file contains large runtime logic
- a framework config file starts acting like an application server
- a UI component contains transport/server/business logic
- a route file contains large reusable service logic
- temporary spike code was promoted into production without extraction
- duplicated logic exists because the agent patched symptoms in many places
- a standalone service was hidden inside a build/dev/config file
- a file grew suspiciously large because the agent solved everything in-place
- the solution works but feels architecturally wrong

Canonical example:

Bad:
A 1000-line WebSocket server is placed directly inside vite.config.ts.

Better:
vite.config.ts only wires config.
The WebSocket server implementation lives in a dedicated module or bin entrypoint, for example:

- bin/tmux-websocket-server.cjs
- src/server/tmux-websocket-server.ts
- src/server/ws/tmux-server.ts
- packages/<name>/server/...

Then package scripts or dev orchestration start it explicitly.

Do not blindly move code.
First prove what owns it and who calls it.

## Required procedure

1. Identify the misplaced code.

Write:

[CODEHOME SUSPECT]
File:
Why this file is suspicious:
Approximate size/scope:
Runtime responsibility found here:

1. Classify the file's proper role.

Examples:

- vite.config.ts:
  should contain Vite config, plugins, aliases, dev-server wiring, build/test config.

- package.json:
  should contain scripts and package metadata, not implementation.

- React component:
  should contain UI state/rendering and call client abstractions, not server runtime implementation.

- route handler:
  may contain HTTP boundary logic, but large reusable business/service logic should move behind a service module.

- bin script:
  may contain process entrypoint wiring, but large reusable logic should move into src/server or lib modules.

- test file:
  should contain test setup and assertions, not production implementation.

1. Decide whether this is a codehome violation.

Use this checklist:

- Is the file doing more than its architectural role?
- Would another developer know to look here?
- Would this code run at unexpected times because config files are loaded by tools?
- Is runtime/server behavior hidden inside build/dev configuration?
- Is this logic reusable but trapped inside a one-off file?
- Is this implementation too large for a boundary/wiring file?
- Is the current location likely to break tooling, tests, production build, or future maintenance?

If yes, it is a codehome violation.

1. Choose the correct home.

Pick the smallest better home.

Do not invent a grand architecture.
Do not create many new layers.
Do not refactor unrelated code.

Preferred movement pattern:

- config keeps config
- entrypoint keeps startup wiring
- server module owns server runtime
- transport module owns socket/tmux/protocol mechanics
- component owns rendering and user interaction
- tests own verification only

1. Extract with one narrow movement.

If edits are authorized:

- move the misplaced implementation into the chosen home
- leave a thin call/import/wiring layer behind
- update imports/scripts
- preserve behavior
- do not mix extraction with feature changes
- do not rename everything
- do not change protocol semantics unless required

If edits are not authorized:

- report the exact extraction plan and stop

1. Verify behavior after rehoming.

Required:

- run targeted tests/typecheck/lint when available
- run the same runtime proof that previously proved the spike
- for frontend/browser behavior, browser runtime proof is required
- compare before/after behavior if possible

Do not claim success from git diff alone.

## Forbidden behavior

- Do not say "it works, so it's fine."
- Do not leave 1000 lines of server logic in a config file.
- Do not bury production logic in tmp, tests, config, or generated files.
- Do not create a huge framework abstraction to fix a placement problem.
- Do not move code just for aesthetics.
- Do not perform architecture astronaut refactors.
- Do not combine codehome cleanup with unrelated product changes.
- Do not ask the user what to do when the correct next step is obvious and non-destructive.

## Output format

[CODEHOME SUSPECT]
File:
Suspicious responsibility:
Why this is the wrong home:

[CORRECT HOME]
Chosen home:
Why this home is better:
What stays behind:

[REHOME PLAN]
Steps:
1.
2.
3.

[CHANGE MADE]
Files changed:
What moved:
What stayed:

[VERIFICATION]
Command/proof:
Result:
Remaining risks:

[STATUS]
resolved / blocked / needs parent verification
