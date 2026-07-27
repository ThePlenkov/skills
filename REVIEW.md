# Review Policy

This file governs how any human or agent reviews changes in this repository.
`AGENTS.md` is the source of truth for what the project is; `REVIEW.md` is
the source of truth for how it is judged.

## Before reviewing — establish the yardstick

Read the available intent first: the pull request description, linked issue,
and relevant specification, before reading the diff. Establish the baseline
against which the change is judged.

## How should the review be executed?

Review each axis independently in fresh context; a single pass lets early findings bias later axes.
If subagents are available, give each axis its own; otherwise run axes sequentially, one at a time, without blending them. If already one of several parallel reviewers, ensure every axis is covered independently rather than spawning another fleet.
Fan-out increases coverage, not output volume: merge and deduplicate findings, apply the verification bar, and enforce the nit cap.

## Intent — is it clear what this change is for, and does it do exactly that?

A change must be explained or self-evident. If the reviewer must reconstruct
its intent, that is a finding, whether or not anyone requested the change.
Keep scope to nothing more and nothing less; scope creep is a finding.

For a non-obvious unexplained change, name where the explanation belongs: the
pull request body for one-off intent, a document or ADR for a durable decision,
an inline comment only when a specific line's why is genuinely non-obvious (a
workaround, non-intuitive ordering, or deliberate trade-off), or a
specification for a new component. Missing comments are findings only when the
code is non-obvious, never as a blanket requirement.
## Correctness & Security — will it break, leak, or misbehave on hostile input?

Threat-model every trust boundary the diff touches: untrusted input, secrets,
authorization, and external calls. Treat model and agent output as untrusted
input, and check failure paths as carefully as happy paths.

## Fit — does it fit where it was put?

Check the layer, directory, naming, file size, and existing components before
accepting new structure. For interchangeable components, two components
covering the same surface, a component contradicting a rule stated elsewhere,
or a document duplicating another document is a finding, not a style nit.

## Evidence — what evidence supports the claim?

Ask what command was run and what it printed; “should work” is not evidence.
Scale the bar to the change: trivial changes need one command and its output,
while behavioral changes need reproducible proof.

## Legibility — will the next agent understand the repository more cheaply?

Check whether the change leaves context clearer, smaller, and current. Update
agent-facing documents before human-facing ones, and treat stale or
contradictory documentation as context poisoning even when the diff did not
create it. Flag aged material near the diff as 🟣 Pre-existing with a
`Prevention:` line; flag at most five such items per review and count the rest.

## How severe is the finding?

- 🔴 **Important** — would break behavior, leak data, or ship the wrong thing.
- 🟡 **Nit** — worth fixing, never blocking.
- 🔵 **Question** — a real uncertainty, unproven claim, or design challenge.
  Asking is a legitimate outcome.
- 🟣 **Pre-existing** — real, but not introduced by this change.

Question is first-class, not a hedge. Prefer a Question over an unsupported assertion and over silence.

## What verification bar applies?

Before posting a behavioral claim, check whether it has a `file:line` citation
or is only inferred from a name or plausible pattern. Publish inference as
🔵 Question, never 🔴 Important; saying “I may be wrong because I did not see
Y” is better than false confidence.

Claims that a version, runtime, action, or dependency is latest, current, or
supported require a live registry or release-page citation. This binds the
reviewer too: do not correct a version from memory and replace one stale claim
with another.

Praise is not a finding. Do not add filler compliments; “no blocking issues” is
one line, not a paragraph.

## How will recurrence be prevented?

Every 🔴 Important finding carries one line beginning `Prevention:` that names
a lint rule, CI gate, AGENTS.md rule, skill change, or explicitly “none,
one-off”.

If the finding violates something already written in AGENTS.md or a skill, the
document is at fault: it is unreadable, unfindable, or unenforced. Prevention
must then be automation or a rewrite of that document, never “be more careful”.
The repository is the only memory a stateless reviewer has, so unwritten
prevention does not exist.

## What should not be reported?

- Skip anything already enforced by a linter, formatter, type-checker, or CI
  gate. If an automatable class is not automated, propose the automation once
  in the summary instead.
- Skip generated or vendored artifacts, lockfiles, and machine-authored index
  files.
- Skip reformatting or renaming preferences without behavioral or comprehension
  impact.

## How much should the review report?

Report at most five 🟡 Nits and give the remainder as a count. After the first
review of a pull request, report 🔴 Important and 🔵 Question findings only; a
one-line fix must not reach round seven on style.

Use bounded inspect, validate, and converge cycles rather than unbounded review
loops.

## What shape should the summary take?

Open with the inferred-intent line when intent was missing, then give a
one-line tally by severity, then the findings.

Close with prevention and automation proposals aggregated so they can be
harvested into the project backlog rather than lost in a thread.

Long-form principles: `$skill{two-axis-review}`, `$skill{security-and-hardening}`, `$skill{architecture-review}`, `$skill{evidence}`, `$skill{context-engineering}`, `$skill{critical-thinking}`, `$skill{retrospect}`, `$skill{loop-programming}`, `$skill{modern-stack}`, and `$skill{harvest}`.
