---
date: 2026-07-27
tags: [review, project-guidelines, skills-layout, decision-needed]
source: https://github.com/theplenkov-ai/skills/pull/175
---

## Problem

`AGENTS.md § Repository rules` states:

> A skill that documents a specific external tool (one CLI / one service with
> its own upstream repo) lives **in that tool's repo**, not here. This repo
> only carries generic methodology, foundation, safety, verification, and
> agent-agnostic tooling. Examples: `gh-stackx` lives in
> `ThePlenkov/gh-stackx`, not here.

`skills/integrations/` currently holds ten skills that match that description
exactly: `atlassian`, `bootstrap-gh-self-hosted-runner`, `codacy`,
`codescene`, `github`, `gitlab`, `gitlab-ci-local`, `glab`, `glean`,
`sourcegraph`. Several more tool skills live under `tools/` (`npm-publish`,
`tsdown`, `skills-cli`, `docker-agent-config`).

Either the rule is wrong or roughly a sixth of the library is misplaced. This
is not a one-off inconsistency to patch: it is an unresolved rule that will
produce the same argument on every new integration skill, and it gives an agent
authoring one no defensible answer about where the file belongs.

The `gh-stackx` example in the rule proves the rule is real and has been acted
on at least once, which makes the contradiction with `integrations/` harder to
read as an oversight.

## Proposed action

Decide, then make the document and the tree agree. Two coherent options:

1. **Narrow the rule.** It applies only to tools whose upstream repo is one you
   control and publish skills from (the `gh-stackx` case). Third-party services
   with no place to host an agent skill stay in `integrations/`. Rewrite the
   rule to say that, with the discriminator stated explicitly.
2. **Keep the rule.** Move the ten integration skills out to their respective
   upstream repos or to a dedicated integrations repo, and consume them through
   `skills-lock.json` the way external skills already work.

Both options must also classify the `tools/` skills listed above
(`npm-publish`, `tsdown`, `skills-cli`, `docker-agent-config`). They are the
same kind of single-upstream tool skills as `gh-stackx`, so the placement rule
or explicit disposition must cover them before this backlog item can be closed.

Option 1 is the smaller change and appears to match observed practice; option 2
matches the text as written. Either way the outcome must be a discriminator an
agent can apply without asking, and `AGENTS.md` must carry it.
