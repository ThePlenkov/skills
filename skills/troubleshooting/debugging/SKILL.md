---
name: debugging
description: Use when an agent is confronted with a runtime failure, wrong output, flaky behavior, regression, performance regression, or crash and needs a disciplined debugging loop. Covers the 4-phase Reproduce → Hypothesize → Test → Fix methodology, stack-trace and log analysis, binary-search regression isolation, and strategic print/debug instrumentation. Built on top of $skill{investigate-first} and feeds into $skill{one-shot-patch}.
allowed-tools: read, grep, glob, exec
argument-hint: <symptom, error message, failing command, or reproduction steps>
triggers:
  - user
  - model
---

# Debugging

Goal: turn an observed symptom into a verified minimal fix without guessing.

Use this skill when:

- a test fails and the cause is unknown
- a runtime error / exception / crash needs to be traced
- behavior changed between versions (regression hunt)
- output is wrong, missing, corrupted, or slow
- a bug is reported by a user without a clear reproduction
- the agent has a hypothesis but cannot confirm it

Do not use this skill for:

- pre-edit exploration of an unfamiliar area (use $skill{investigate-first})
- a known small fix hypothesis (use $skill{one-shot-patch})
- architectural or refactoring work (use $skill{architecture-review} / $skill{refactoring})
- performance-only complaints without a reproducible symptom (use $skill{performance-investigation})

## 4-Phase Methodology

### Phase 1: Reproduce

Make the failure deterministic.

Steps:

1. Capture the exact symptom:
   - error message, stack trace, log line, wrong value, exit code
   - when it appeared (commit, deploy, time)
   - on which inputs / environment / branch
2. Strip the problem to the smallest reproduction possible:
   - remove unrelated data, flags, network calls
   - prefer a single test, a single CLI command, a single HTTP request
3. Confirm the minimal reproduction reliably fails.
4. Capture the environment fingerprint:
   - language/runtime version
   - OS, env vars, config
   - database/cache state if relevant

If reproduction is impossible, stop and report the gap. Do not debug on speculation.

Output of Phase 1:

- Smallest reproducible case
- Reproduction command/script
- Expected vs actual behavior
- Environment fingerprint

### Phase 2: Hypothesize

Generate ranked hypotheses, not one guess.

Steps:

1. List everything that could cause the exact symptom. Use the stack trace, the data flow, the recent diff, and the language/runtime semantics.
2. Rank by:
   - likelihood given the evidence
   - cost to test
3. Prefer hypotheses that explain all observed evidence over ones that explain only part.
4. For each top hypothesis, state the prediction:
   - "If this is the cause, then changing X should make the symptom disappear without breaking Y."

Output of Phase 2:

- Ranked hypotheses (typically 3-5)
- For each top hypothesis: the discriminating test
- The "if true, I expect ..." prediction

### Phase 3: Test

Confirm or eliminate one hypothesis at a time.

Tactics, in order of cost:

1. Read the code path (cheapest).
2. Inspect live state (logs, dumps, debugger snapshot).
3. Strategic instrumentation:
   - narrow print/log at the suspected boundary, never broad sprinkling
   - guard with a feature flag or env var
   - log inputs, outputs, branch decisions
4. Binary search for the regression commit:
   - bisect the commit range with the minimal reproduction
   - reduce test surface (single test → file → module)
5. Targeted experiment:
   - flip one variable at a time
   - keep the rest of the system identical

Never change code in this phase unless the experiment itself is the fix. If a code change starts to look like a fix, switch to $skill{one-shot-patch}.

Output of Phase 3:

- Hypothesis confirmed / eliminated, with evidence
- Narrowest change that demonstrates the cause
- Side effects observed

### Phase 4: Fix

Apply the minimal fix that addresses the root cause, not the symptom.

Steps:

1. State the root cause in one sentence.
2. Apply $skill{minimal-root-cause} before touching code.
3. Apply the smallest change that eliminates the cause.
4. Add or update a regression test that fails before and passes after.
5. Run the targeted test, then the surrounding test suite.
6. Apply $skill{evidence} to record the run that proves the fix.

Output of Phase 4:

- Root cause sentence
- Files changed
- Regression test added/updated
- Verification command + result

## Stack Trace Analysis

Read stack traces top-down and bottom-up:

- Top frame: where the exception was thrown
- Bottom frames: entry points / async roots
- Repeated frames: recursion / hot loops
- Library frames vs application frames: locate the first application frame from the top

For each application frame ask:

1. What input reached this function?
2. What invariant was violated?
3. Which assumption was wrong?

Reject any hypothesis that depends on "the framework is broken."

## Log Analysis Patterns

Treat logs as evidence, not noise:

- Correlate timestamps across services
- Match request IDs / trace IDs end-to-end
- Look for first appearance of the symptom, not last
- Grep for the symptom and its negation ("timeout" and "completed")
- Note log level changes — a new warn/error is a strong signal
- Suppress noise; do not silence the failing signal

## Binary Search for Regression Introduction

When the symptom did not exist before:

1. Identify the oldest known-good commit and newest known-bad commit.
2. Pick the midpoint.
3. Run the minimal reproduction at that commit.
4. Mark midpoint as good or bad.
5. Repeat on the half that contains the bad commit.
6. Stop at the single commit (or single PR) that introduced the regression.

Use `git bisect` with the reproduction command when available. Treat merge commits and reverts with care.

## Print / Debug Injection Strategy

Inject narrowly, verify locally, remove before commit:

1. Pick the narrowest boundary that crosses the suspected cause.
2. Print structured context, not just "got here."
3. Guard instrumentation with an env flag so production is unaffected.
4. Reproduce, capture, then remove the prints in the same change.
5. Replace the temporary print with a permanent log/test if the information matters.

Never leave debug prints in committed code.

## Required output

Symptom: ...
Smallest reproduction: ...
Top hypothesis: ...
Discriminating test: ...
Root cause: ...
Fix: ...
Regression test: ...
Verification command: ...
Verification result: ...
Remaining risk: ...

## Stop conditions

Stop and report blocked if:

- the symptom cannot be reproduced
- all plausible hypotheses require destructive changes
- evidence points to multiple unrelated causes (split)
- the fix needs data the agent cannot access (secrets, prod)
- the user has not approved a destructive or data-altering step

## Related skills

- $skill{investigate-first} — pre-edit exploration; debugging assumes symptom is reproducible.
- $skill{minimal-root-cause} — apply before patching.
- $skill{one-shot-patch} — switch to it once the fix hypothesis is known.
- $skill{evidence} — record the run that proves the fix.
- $skill{performance-investigation} — switch when the symptom is "too slow" rather than "wrong."
