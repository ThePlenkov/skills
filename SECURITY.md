# Security Policy

This repository publishes agent skills and role prompts. It contains no
versioned software, no executable runtime, and no services that accept input
from the public. Skills are Markdown text consumed by local agents; they do
not run code of their own.

## Reporting a vulnerability in a skill

If you find a skill in this repository that:

- instructs an agent to perform a destructive or unsafe action against the
  user's environment without a clear justification,
- leaks credentials, tokens, or private infrastructure details,
- or otherwise behaves in a way that contradicts its stated description,

please open a [private security advisory](https://github.com/ThePlenkov/skills/security/advisories/new)
on GitHub instead of a public issue. We will triage and respond within a few
business days.

Out-of-scope:

- Opinionated prompt wording or role-prompt design choices.
- Findings produced by AI/heuristic skill scanners (e.g. SkillSpector) that
  match patterns intentional to this repository's design (autonomy, sandbox
  language, permission framing). These are tracked in `.skillspector-baseline.yaml`.