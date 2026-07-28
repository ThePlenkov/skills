---
date: 2026-07-27
tags: [review, legibility, documentation, context-poisoning]
source: https://github.com/theplenkov-ai/skills/pull/175
---

## Problem

`AGENTS.md § Layout` presents itself as the canonical map of the repository —
`CLAUDE.md` defers to it explicitly — but several tracked top-level directories
are absent from it:

- `harbor/` — a Docker agent subsystem with its own `Dockerfile`, build script,
  and agent definitions. It is mentioned in **no** markdown file outside its own
  directory.
- `actions/` — the SkillSpector composite GitHub Action, referenced by
  `.github/workflows/skill-scan.yml`.
- `bin/` — the `skills` CLI entrypoint, exercised by the `wrapper-regression`
  job in `.github/workflows/ci.yml`.
- `scripts/` — appears in the prose of other sections but not in the layout list
  itself.

An agent onboarding through `AGENTS.md` gets a map that omits a working
subsystem. That is worse than no map: it produces confident wrong conclusions
about where things live, and it is the failure mode `REVIEW.md` calls context
poisoning.

The absence of `harbor/` is the acute case, since nothing anywhere explains what
it is or whether it is still live.

## Proposed action

1. Add `harbor/`, `actions/`, `bin/`, and `scripts/` to the `AGENTS.md § Layout`
   list with a one-line purpose each, in the style of the neighbouring bullets.
2. Determine whether `harbor/` is still maintained. If it is dead, delete it; a
   tracked-but-undocumented subsystem is a liability either way.
3. Add a check that every tracked top-level directory appears in the
   `AGENTS.md § Layout` list. `scripts/check-readme-categories.ts` already
   implements the same shape of check for README categories and is the natural
   model; without it this list goes stale again on the next new directory.
