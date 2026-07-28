---
date: 2026-07-27
tags: [review, automation, ci, skills-graph]
source: https://github.com/theplenkov-ai/skills/pull/175
---

## Problem

With 93 skills that reference each other freely, a dependency cycle between
skills is easy to introduce and effectively invisible in review: no reader
holds the whole graph in their head, and the cycle only manifests later as an
agent loading skills in a loop or as two skills each deferring to the other.

`scripts/generate-skills-graph.ts` already parses cross-skill references and
builds the graph that `.github/workflows/skills-graph.yml` renders, but it
contains no cycle, circularity, or topological check — it only draws what it
finds.

This belongs in CI rather than in review. `REVIEW.md` states that anything a
check can enforce should not be reviewed by hand, and a cycle is a
deterministic graph property, not a judgement call.

## Proposed action

Add cycle detection to `scripts/generate-skills-graph.ts` on the graph it
already builds, and fail the `skills-graph` workflow when a cycle is found,
printing the participating skills in path order so the offending edge is
obvious.

Two decisions to make while implementing:

- Whether a mutual reference between two skills that merely say "see also" is a
  cycle worth failing on, or whether only a declared dependency edge counts.
  The former will likely produce noise; prefer distinguishing reference kinds
  over loosening the check.
- Whether to fail or warn on first rollout. If existing cycles are found,
  record them as a baseline (the pattern `.skillspector-baseline.yaml` already
  establishes) and fail only on new ones.
