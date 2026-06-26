---
name: runtime-proof
description: Use after code changes or before final completion when Devin must prove actual behavior in the target runtime. Enforces meaningful backend/API tests, CLI checks, or frontend browser automation. Required for HTML, UI, browser JavaScript, hydration, routing, and client-side behavior where curl is not enough.
allowed-tools: read, grep, glob, write, exec
argument-hint: <behavior or environment to prove>
triggers: ["user", "model"]
---

# Runtime Proof

Goal: prove the true objective with runtime-level evidence.

## Choose target environment

Classify the proof target:
- backend/API
- CLI/script
- frontend/browser
- integration/service
- test suite

## Backend/API proof

A 200 response is not enough if the objective involves correctness, auth, persistence, side effects, or data shape.

Show:
- command executed
- response or test output
- assertion that matches the true objective

## Frontend/browser proof

For frontend, HTML, UI, client-side JavaScript, browser routing, hydration, or page behavior, curl is forbidden as final proof.

Use an existing browser test if it proves the objective.

If no browser test exists, create a temporary verification script when allowed. The script must:
- navigate to the real local URL
- capture console errors
- capture uncaught page errors
- wait for app initialization
- assert the relevant UI behavior
- exit non-zero on failure

## Required output

Target environment: ...
Verification method: ...
Command executed: ...
Important output: ...
What the output proves: ...
Remaining gaps: ...
