---
date: 2026-07-27
tags: [review, correctness, agent-prompts, automation]
source: https://github.com/theplenkov-ai/skills/pull/175
---

## Problem

Role prompts instruct agents to load skills that do not exist, and nothing
catches it.

- `subagents-setup` is referenced 9 times across `.agents/agents/*/AGENT.md`,
  `AGENTS.md § Role prompts`, and `CLAUDE.md:48`. No `subagents-setup` skill
  exists under `skills/`. The closest real skill is `subagent-capsule`.
- `@skills:sandbox` is referenced in `.agents/agents/coder/AGENT.md:167`,
  `patcher/AGENT.md:47`, `verifier/AGENT.md:38`, and
  `investigator/AGENT.md:39`. The real skill is `sandboxed`.

Both are instructions an agent is told to follow and cannot. `AGENTS.md` and
`CLAUDE.md` document the broken name as the required convention, so the
documentation is the source of the defect, not any single prompt.

A second, related drift: `AGENTS.md § Skill references` permits both bare `$name`
and `$skill{name}`, while role prompts use a third form, `@skills:name`, 28 times.
Three notations for one concept means no single check can be written until one
is chosen. The canonical should be `$skill{name}`; both bare `$name` and
`@skills:` must be migrated to it.

`scripts/validate-agent-manifests.sh` already resolves skill names for
`manifest.yaml`, so the resolution logic exists; it simply is not applied to
prompt and document bodies.

## Proposed action

1. Choose `$skill{name}` as the only canonical notation, then migrate both
   bare `$name` and `@skills:` occurrences to it. Update `AGENTS.md § Skill
   references` and `scripts/validate-agent-manifests.sh` to reject the other
   two forms.
2. Fix the two broken targets: `subagents-setup` either gets created as a real
   skill or every reference is repointed at `subagent-capsule`; `@skills:sandbox`
   becomes `sandboxed`.
3. Extend `scripts/validate-agent-manifests.sh` (or add a sibling script wired
   into the existing `validate-skills` workflow) to scan `.agents/**/*.md`,
   `skills/**/SKILL.md`, `AGENTS.md`, and `CLAUDE.md` for skill references and
   fail when a referenced name does not resolve to a directory under `skills/`
   or to a materialized installed skill under `.agents/skills/<name>`. A
   `skills-lock.json` entry alone is not enough; treat stale external lock-only
   entries as unresolved unless the validator documents and implements a separate
   explicit contract for external locked skills.

Step 3 is the durable part: without it, step 2 regresses the next time a skill
is renamed.
