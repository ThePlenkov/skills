# Review Policy

This file governs how any human or agent reviews changes in this repository.
`AGENTS.md` is the source of truth for what the project is; `REVIEW.md` is
the source of truth for how it is judged.

## Before reviewing — establish the yardstick

Read the stated intent first: the pull request description, linked issue, and
relevant specification. If intent is absent or unverifiable, make that the
first finding about the author.

State the inferred intent at the top of the summary: “I assumed the goal was X;
if that is wrong, the findings below are unreliable.” Flawless code that does
the wrong thing is the most expensive failure mode.

## Intent — does the change do exactly what was asked?

Review intent and scope, not just implementation. Scope creep and unnamed
beneficiaries are findings; if you cannot name who or what this change is for,
say so. Nothing more and nothing less is the target.

## Correctness & Security — will it break, leak, or misbehave on hostile input?

Threat-model every trust boundary the diff touches: untrusted input, secrets,
authorization, and external calls. Treat model and agent output as untrusted
input, and check failure paths as carefully as happy paths.

## Fit — does it fit where it was put?

Check the layer, directory, naming, file size, and existing components before
accepting new structure. Duplicating or contradicting something already in the
repository is a finding in its own right, not a style nit.

## Evidence — what evidence supports the claim?

Ask what command was run and what it printed; “should work” is not evidence.
Scale the bar to the change: trivial changes need one command and its output,
while behavioral changes need reproducible proof.

## Legibility — will the next agent understand the repository more cheaply?

Check whether the change leaves context clearer, smaller, and current. Update
agent-facing documents before human-facing ones, and treat stale or
contradictory documentation as context poisoning even when the diff did not
create it.

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

Long-form principles: `$skill{two-axis-review}`, `$skill{security-and-hardening}`, `$skill{architecture-review}`, `$skill{evidence}`, `$skill{context-engineering}`, `$skill{critical-thinking}`, `$skill{retrospect}`, `$skill{loop-programming}`, and `$skill{harvest}`.
