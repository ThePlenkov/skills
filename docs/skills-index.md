# Skills Index

Auto-generated from skill frontmatter. Run `npx tsx scripts/generate-skills-index-md.ts` to regenerate.

## Summary

- **Total skills:** 96
- **Context window (default):** 128,000 tokens
- **Skills metadata budget (2%):** 2,560 tokens
- **Total description tokens:** 6,699 tokens
- **Overflow vs. 2% budget:** 2.62x
- **Total skill file tokens:** 180,293 tokens

Token counts use the same approximation Codex uses for its skills context budget: `ceil(byte_length / 4)`.

## By category

| Category | Skills | Description tokens | Total tokens |
| --- | --- | --- | --- |
| agents | 2 | 83 | 1,196 |
| behavior | 1 | 106 | 1,923 |
| coaching | 2 | 191 | 5,196 |
| code-review | 6 | 472 | 18,044 |
| engineering | 8 | 513 | 15,917 |
| experimentation | 1 | 101 | 1,770 |
| foundation | 4 | 320 | 9,081 |
| integrations | 10 | 476 | 10,815 |
| methodology | 23 | 1,657 | 48,954 |
| orchestration | 5 | 366 | 9,666 |
| research | 2 | 170 | 3,140 |
| safety | 3 | 224 | 4,584 |
| self-learning | 2 | 169 | 3,552 |
| tools | 7 | 425 | 12,533 |
| troubleshooting | 2 | 216 | 3,699 |
| verification | 2 | 161 | 3,489 |
| workflow | 16 | 1,049 | 26,734 |

## Skill catalog

| Skill | Category | Tier | Default enabled | Description tokens | Total tokens | Triggers | Claude model | Codex implicit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [`claude-skills`](skills/agents/claude-skills/SKILL.md) | agents | 2 | yes | 41 | 288 | user, model | yes | yes |
| [`dotagents`](skills/agents/dotagents/SKILL.md) | agents | 2 | yes | 42 | 908 | user, model | yes | yes |
| [`architecture-review`](skills/behavior/architecture-review/SKILL.md) | behavior | 2 | yes | 106 | 1,923 | user, model | yes | yes |
| [`adhd`](skills/coaching/adhd/SKILL.md) | coaching | 2 | yes | 69 | 1,571 | user, model | yes | yes |
| [`interview-me`](skills/coaching/interview-me/SKILL.md) | coaching | 2 | yes | 122 | 3,625 | user, model | yes | yes |
| [`act`](skills/code-review/act/SKILL.md) | code-review | 2 | no | 116 | 7,518 | user | no | no |
| [`github-fix-main`](skills/code-review/github-fix-main/SKILL.md) | code-review | 2 | yes | 63 | 1,990 | user, model | yes | yes |
| [`github-pr-review`](skills/code-review/github-pr-review/SKILL.md) | code-review | 2 | yes | 29 | 2,351 | user, model | yes | yes |
| [`mr-address-review`](skills/code-review/mr-address-review/SKILL.md) | code-review | 2 | yes | 82 | 1,759 | user, model | yes | yes |
| [`triage-issue`](skills/code-review/triage-issue/SKILL.md) | code-review | 2 | yes | 65 | 1,626 | user, model | yes | yes |
| [`two-axis-review`](skills/code-review/two-axis-review/SKILL.md) | code-review | 2 | yes | 117 | 2,800 | user, model | yes | yes |
| [`api-and-interface-design`](skills/engineering/api-and-interface-design/SKILL.md) | engineering | 2 | yes | 63 | 2,594 | user, model | yes | yes |
| [`bootstrap-ts-repo`](skills/engineering/bootstrap-ts-repo/SKILL.md) | engineering | 2 | yes | 61 | 2,079 | user, model | yes | yes |
| [`frontend-ui-engineering`](skills/engineering/frontend-ui-engineering/SKILL.md) | engineering | 2 | yes | 77 | 2,691 | user, model | yes | yes |
| [`nodejs`](skills/engineering/nodejs/SKILL.md) | engineering | 2 | yes | 36 | 1,413 | user, model | yes | yes |
| [`performance-optimization`](skills/engineering/performance-optimization/SKILL.md) | engineering | 2 | yes | 74 | 2,929 | user, model | yes | yes |
| [`prototype`](skills/engineering/prototype/SKILL.md) | engineering | 2 | yes | 82 | 1,098 | user, model | yes | yes |
| [`security-and-hardening`](skills/engineering/security-and-hardening/SKILL.md) | engineering | 2 | yes | 62 | 2,006 | user, model | yes | yes |
| [`typescript`](skills/engineering/typescript/SKILL.md) | engineering | 2 | yes | 58 | 1,107 | user, model | yes | yes |
| [`sandboxed`](skills/experimentation/sandboxed/SKILL.md) | experimentation | 2 | no | 101 | 1,770 | user | no | no |
| [`minimalist`](skills/foundation/minimalist/SKILL.md) | foundation | 2 | yes | 124 | 3,538 | user, model | yes | yes |
| [`persistent-memory`](skills/foundation/persistent-memory/SKILL.md) | foundation | 1 | no | 78 | 2,449 | user | no | no |
| [`skill-tiers`](skills/foundation/skill-tiers/SKILL.md) | foundation | 2 | yes | 55 | 1,095 | user, model | yes | yes |
| [`token-rationalism`](skills/foundation/token-rationalism/SKILL.md) | foundation | 0 | always | 63 | 1,999 | always | yes | yes |
| [`atlassian`](skills/integrations/atlassian/SKILL.md) | integrations | 2 | yes | 58 | 257 | user, model | yes | yes |
| [`bootstrap-gh-self-hosted-runner`](skills/integrations/bootstrap-gh-self-hosted-runner/SKILL.md) | integrations | 2 | no | 44 | 2,380 | user | no | no |
| [`codacy`](skills/integrations/codacy/SKILL.md) | integrations | 2 | yes | 40 | 1,684 | user, model | yes | yes |
| [`codescene`](skills/integrations/codescene/SKILL.md) | integrations | 2 | yes | 34 | 1,716 | user, model | yes | yes |
| [`github`](skills/integrations/github/SKILL.md) | integrations | 2 | yes | 54 | 929 | user, model | yes | yes |
| [`gitlab`](skills/integrations/gitlab/SKILL.md) | integrations | 2 | yes | 60 | 304 | user, model | yes | yes |
| [`gitlab-ci-local`](skills/integrations/gitlab-ci-local/SKILL.md) | integrations | 2 | yes | 39 | 375 | user, model | yes | yes |
| [`glab`](skills/integrations/glab/SKILL.md) | integrations | 2 | yes | 33 | 579 | user, model | yes | yes |
| [`glean`](skills/integrations/glean/SKILL.md) | integrations | 2 | yes | 44 | 877 | user, model | yes | yes |
| [`sourcegraph`](skills/integrations/sourcegraph/SKILL.md) | integrations | 2 | yes | 70 | 1,714 | user, model | yes | yes |
| [`code-review-and-quality`](skills/methodology/code-review-and-quality/SKILL.md) | methodology | 2 | yes | 60 | 2,833 | user, model | yes | yes |
| [`code-simplification`](skills/methodology/code-simplification/SKILL.md) | methodology | 2 | yes | 61 | 3,378 | user, model | yes | yes |
| [`codehome`](skills/methodology/codehome/SKILL.md) | methodology | 2 | no | 69 | 1,475 | user | no | no |
| [`context-engineering`](skills/methodology/context-engineering/SKILL.md) | methodology | 2 | yes | 50 | 2,788 | user, model | yes | yes |
| [`critical-thinking`](skills/methodology/critical-thinking/SKILL.md) | methodology | 2 | yes | 81 | 2,582 | user, model | yes | yes |
| [`dep-cost`](skills/methodology/dep-cost/SKILL.md) | methodology | 2 | yes | 95 | 1,934 | user, model | yes | yes |
| [`doubt-driven-development`](skills/methodology/doubt-driven-development/SKILL.md) | methodology | 2 | yes | 85 | 3,890 | user, model | yes | yes |
| [`idea-refine`](skills/methodology/idea-refine/SKILL.md) | methodology | 2 | yes | 84 | 2,021 | user, model | yes | yes |
| [`incremental-implementation`](skills/methodology/incremental-implementation/SKILL.md) | methodology | 2 | yes | 56 | 2,338 | user, model | yes | yes |
| [`investigate-first`](skills/methodology/investigate-first/SKILL.md) | methodology | 2 | yes | 82 | 452 | user, model | yes | yes |
| [`loop-programming`](skills/methodology/loop-programming/SKILL.md) | methodology | 2 | yes | 115 | 2,495 | user, model | yes | yes |
| [`minimal-root-cause`](skills/methodology/minimal-root-cause/SKILL.md) | methodology | 2 | yes | 64 | 736 | user, model | yes | yes |
| [`modern-stack`](skills/methodology/modern-stack/SKILL.md) | methodology | 2 | yes | 44 | 1,581 | user, model | yes | yes |
| [`observability-and-instrumentation`](skills/methodology/observability-and-instrumentation/SKILL.md) | methodology | 2 | yes | 77 | 2,778 | user, model | yes | yes |
| [`one-shot-patch`](skills/methodology/one-shot-patch/SKILL.md) | methodology | 2 | yes | 68 | 403 | user, model | yes | yes |
| [`refactoring`](skills/methodology/refactoring/SKILL.md) | methodology | 2 | yes | 105 | 1,947 | user, model | yes | yes |
| [`repository-onboarding`](skills/methodology/repository-onboarding/SKILL.md) | methodology | 2 | yes | 99 | 1,830 | user, model | yes | yes |
| [`reuse-first`](skills/methodology/reuse-first/SKILL.md) | methodology | 2 | yes | 73 | 2,176 | user, model | yes | yes |
| [`review-methodology`](skills/methodology/review-methodology/SKILL.md) | methodology | 2 | yes | 84 | 1,115 | user, model | yes | yes |
| [`source-driven-development`](skills/methodology/source-driven-development/SKILL.md) | methodology | 2 | yes | 55 | 2,065 | user, model | yes | yes |
| [`spec-driven-development`](skills/methodology/sdd/spec-driven-development/SKILL.md) | methodology | 2 | yes | 51 | 2,166 | user, model | yes | yes |
| [`spec-kit`](skills/methodology/sdd/spec-kit/SKILL.md) | methodology | 2 | yes | 41 | 2,214 | user, model | yes | yes |
| [`test-driven-development`](skills/methodology/test-driven-development/SKILL.md) | methodology | 2 | yes | 58 | 3,757 | user, model | yes | yes |
| [`handoff`](skills/orchestration/handoff/SKILL.md) | orchestration | 2 | no | 91 | 3,138 | user | no | no |
| [`save-session`](skills/orchestration/save-session/SKILL.md) | orchestration | 2 | no | 51 | 2,343 | user | no | no |
| [`subagent-capsule`](skills/orchestration/subagent-capsule/SKILL.md) | orchestration | 2 | yes | 79 | 558 | user, model | yes | yes |
| [`unwind`](skills/orchestration/unwind/SKILL.md) | orchestration | 2 | no | 90 | 1,027 | user | no | no |
| [`using-agent-skills`](skills/orchestration/using-agent-skills/SKILL.md) | orchestration | 2 | yes | 55 | 2,600 | user, model | yes | yes |
| [`deepwiki`](skills/research/deepwiki/SKILL.md) | research | 2 | yes | 57 | 1,779 | user, model | yes | yes |
| [`external-research`](skills/research/external-research/SKILL.md) | research | 2 | yes | 113 | 1,361 | user, model | yes | yes |
| [`drill`](skills/safety/drill/SKILL.md) | safety | 2 | yes | 52 | 2,068 | user, model | yes | yes |
| [`safeguard`](skills/safety/safeguard/SKILL.md) | safety | 2 | yes | 98 | 1,700 | user, model | yes | yes |
| [`salvage`](skills/safety/salvage/SKILL.md) | safety | 2 | no | 74 | 816 | user | no | no |
| [`retrospect`](skills/self-learning/retrospect/SKILL.md) | self-learning | 2 | yes | 51 | 1,775 | user, model | yes | yes |
| [`skill-feedback`](skills/self-learning/skill-feedback/SKILL.md) | self-learning | 2 | yes | 118 | 1,777 | user, model | yes | yes |
| [`docker-agent-config`](skills/tools/docker-agent-config/SKILL.md) | tools | 2 | yes | 75 | 3,509 | user, model | yes | yes |
| [`npm-publish`](skills/tools/npm-publish/SKILL.md) | tools | 2 | yes | 76 | 2,111 | user, model | yes | yes |
| [`sarif-to-annotations`](skills/tools/sarif-to-annotations/SKILL.md) | tools | 2 | yes | 92 | 1,484 | user, model | yes | yes |
| [`skillmaker`](skills/tools/skillmaker/SKILL.md) | tools | 2 | yes | 43 | 1,469 | user, model | yes | yes |
| [`skills-cli`](skills/tools/skills-cli/SKILL.md) | tools | 2 | yes | 20 | 502 | user, model | yes | yes |
| [`tsdown`](skills/tools/tsdown/SKILL.md) | tools | 2 | yes | 52 | 802 | user, model | yes | yes |
| [`writing-great-skills`](skills/tools/writing-great-skills/SKILL.md) | tools | 2 | no | 67 | 2,656 | user | no | no |
| [`debugging`](skills/troubleshooting/debugging/SKILL.md) | troubleshooting | 2 | yes | 109 | 1,830 | user, model | yes | yes |
| [`performance-investigation`](skills/troubleshooting/performance-investigation/SKILL.md) | troubleshooting | 2 | yes | 107 | 1,869 | user, model | yes | yes |
| [`evidence`](skills/verification/evidence/SKILL.md) | verification | 2 | yes | 85 | 2,798 | user, model | yes | yes |
| [`evidence-lite`](skills/verification/evidence-lite/SKILL.md) | verification | 2 | yes | 76 | 691 | user, model | yes | yes |
| [`backlog`](skills/workflow/planning/backlog/SKILL.md) | workflow | 2 | yes | 26 | 647 | user, model | yes | yes |
| [`ci-cd-and-automation`](skills/workflow/ci-cd-and-automation/SKILL.md) | workflow | 2 | yes | 52 | 1,529 | user, model | yes | yes |
| [`ci-local`](skills/workflow/testing/ci-local/SKILL.md) | workflow | 2 | yes | 59 | 1,056 | user, model | yes | yes |
| [`deprecation-and-migration`](skills/workflow/deprecation-and-migration/SKILL.md) | workflow | 2 | yes | 52 | 3,146 | user, model | yes | yes |
| [`documentation-and-adrs`](skills/workflow/documentation-and-adrs/SKILL.md) | workflow | 2 | yes | 56 | 2,458 | user, model | yes | yes |
| [`e2e`](skills/workflow/testing/e2e/SKILL.md) | workflow | 2 | no | 78 | 612 | user | no | no |
| [`git-commit`](skills/workflow/git/git-commit/SKILL.md) | workflow | 2 | yes | 83 | 1,088 | user, model | yes | yes |
| [`git-push`](skills/workflow/git/git-push/SKILL.md) | workflow | 2 | yes | 83 | 1,126 | user, model | yes | yes |
| [`git-reset`](skills/workflow/git/git-reset/SKILL.md) | workflow | 2 | no | 66 | 1,450 | user | no | no |
| [`git-workflow-and-versioning`](skills/workflow/git/git-workflow-and-versioning/SKILL.md) | workflow | 2 | yes | 71 | 3,518 | user, model | yes | yes |
| [`harvest`](skills/workflow/debt/harvest/SKILL.md) | workflow | 2 | no | 107 | 2,066 | user | no | no |
| [`planning-and-task-breakdown`](skills/workflow/planning/planning-and-task-breakdown/SKILL.md) | workflow | 2 | yes | 60 | 1,923 | user, model | yes | yes |
| [`resolving-merge-conflicts`](skills/workflow/git/resolving-merge-conflicts/SKILL.md) | workflow | 2 | yes | 75 | 1,228 | user, model | yes | yes |
| [`shadow-fork`](skills/workflow/git/shadow-fork/SKILL.md) | workflow | 2 | yes | 64 | 1,666 | user, model | yes | yes |
| [`shared-plan`](skills/workflow/planning/shared-plan/SKILL.md) | workflow | 2 | yes | 63 | 673 | user, model | yes | yes |
| [`shipping-and-launch`](skills/workflow/shipping-and-launch/SKILL.md) | workflow | 2 | yes | 54 | 2,548 | user, model | yes | yes |

## Definitions

- **Description tokens:** Approximate token count of the `description` frontmatter field (the metadata loaded into the agent context).
- **Total tokens:** Approximate token count of the entire `SKILL.md` file.
- **Default enabled:** Whether the skill is visible to the model without an explicit user invocation.
  - `yes`: loaded by default in both Claude/Cursor and Codex.
  - `no`: explicit-only (user must type the skill name).
  - `partial`: loaded by default in one tool but blocked in another.
  - `always`: Tier 0 always-on skill.
- **Claude model:** `yes` unless `disable-model-invocation: true` or the skill is user-only.
- **Codex implicit:** `yes` unless `agents/openai.yaml` sets `allow_implicit_invocation: false` or the skill is user-only.
