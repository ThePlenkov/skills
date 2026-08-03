# Skills Index

Auto-generated from skill frontmatter. Run `npx tsx scripts/generate-skills-index-md.ts` to regenerate.

## Summary

- **Total skills:** 92
- **Context window (default):** 128,000 tokens
- **Skills metadata budget (2%):** 2,560 tokens
- **Total description tokens:** 6,450 tokens
- **Overflow vs. 2% budget:** 2.52x
- **Total skill file tokens:** 170,830 tokens

Token counts use the same approximation Codex uses for its skills context budget: `ceil(byte_length / 4)`.

## By category

| Category | Skills | Description tokens | Total tokens |
| --- | --- | --- | --- |
| agents | 2 | 83 | 1,216 |
| behavior | 1 | 106 | 1,880 |
| coaching | 2 | 191 | 5,163 |
| code-review | 6 | 412 | 15,742 |
| engineering | 8 | 513 | 15,490 |
| experimentation | 1 | 101 | 1,511 |
| foundation | 4 | 320 | 8,427 |
| integrations | 6 | 271 | 8,563 |
| methodology | 23 | 1,675 | 46,878 |
| orchestration | 5 | 366 | 9,433 |
| research | 2 | 170 | 3,096 |
| safety | 3 | 224 | 4,146 |
| self-learning | 2 | 167 | 3,575 |
| tools | 7 | 425 | 12,367 |
| troubleshooting | 2 | 216 | 3,596 |
| verification | 2 | 161 | 3,371 |
| workflow | 16 | 1,049 | 26,376 |

## Skill catalog

| Skill | Category | Tier | Default enabled | Description tokens | Total tokens | Triggers | Claude model | Codex implicit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [`claude-skills`](skills/agents/claude-skills/SKILL.md) | agents | 2 | yes | 41 | 358 | user, model | yes | yes |
| [`dotagents`](skills/agents/dotagents/SKILL.md) | agents | 2 | yes | 42 | 858 | user, model | yes | yes |
| [`architecture-review`](skills/behavior/architecture-review/SKILL.md) | behavior | 2 | yes | 106 | 1,880 | user, model | yes | yes |
| [`adhd`](skills/coaching/adhd/SKILL.md) | coaching | 2 | yes | 69 | 1,554 | user, model | yes | yes |
| [`interview-me`](skills/coaching/interview-me/SKILL.md) | coaching | 2 | yes | 122 | 3,609 | user, model | yes | yes |
| [`act`](skills/code-review/act/SKILL.md) | code-review | 2 | yes | 116 | 7,082 | user, model | yes | yes |
| [`github-fix-main`](skills/code-review/github-fix-main/SKILL.md) | code-review | 2 | yes | 63 | 1,969 | user, model | yes | yes |
| [`github-pr-review`](skills/code-review/github-pr-review/SKILL.md) | code-review | 2 | yes | 29 | 2,356 | user, model | yes | yes |
| [`mr-address-review`](skills/code-review/mr-address-review/SKILL.md) | code-review | 2 | yes | 22 | 120 | user, model | yes | yes |
| [`triage-issue`](skills/code-review/triage-issue/SKILL.md) | code-review | 2 | yes | 65 | 1,579 | user, model | yes | yes |
| [`two-axis-review`](skills/code-review/two-axis-review/SKILL.md) | code-review | 2 | yes | 117 | 2,636 | user, model | yes | yes |
| [`api-and-interface-design`](skills/engineering/api-and-interface-design/SKILL.md) | engineering | 2 | yes | 63 | 2,579 | user, model | yes | yes |
| [`bootstrap-ts-repo`](skills/engineering/bootstrap-ts-repo/SKILL.md) | engineering | 2 | yes | 61 | 2,039 | user, model | yes | yes |
| [`frontend-ui-engineering`](skills/engineering/frontend-ui-engineering/SKILL.md) | engineering | 2 | yes | 77 | 2,675 | user, model | yes | yes |
| [`nodejs`](skills/engineering/nodejs/SKILL.md) | engineering | 2 | yes | 36 | 1,378 | user, model | yes | yes |
| [`performance-optimization`](skills/engineering/performance-optimization/SKILL.md) | engineering | 2 | yes | 74 | 2,914 | user, model | yes | yes |
| [`prototype`](skills/engineering/prototype/SKILL.md) | engineering | 2 | partial | 82 | 843 | user, model | no | yes |
| [`security-and-hardening`](skills/engineering/security-and-hardening/SKILL.md) | engineering | 2 | yes | 62 | 1,990 | user, model | yes | yes |
| [`typescript`](skills/engineering/typescript/SKILL.md) | engineering | 2 | yes | 58 | 1,072 | user, model | yes | yes |
| [`sandboxed`](skills/experimentation/sandboxed/SKILL.md) | experimentation | 2 | yes | 101 | 1,511 | user, model | yes | yes |
| [`minimalist`](skills/foundation/minimalist/SKILL.md) | foundation | 2 | yes | 124 | 3,498 | user, model | yes | yes |
| [`persistent-memory`](skills/foundation/persistent-memory/SKILL.md) | foundation | 1 | no | 78 | 2,433 | user | no | no |
| [`skill-tiers`](skills/foundation/skill-tiers/SKILL.md) | foundation | 2 | yes | 55 | 512 | user, model | yes | yes |
| [`token-rationalism`](skills/foundation/token-rationalism/SKILL.md) | foundation | 0 | always | 63 | 1,984 | always | yes | yes |
| [`bootstrap-gh-self-hosted-runner`](skills/integrations/bootstrap-gh-self-hosted-runner/SKILL.md) | integrations | 2 | no | 44 | 2,356 | user | no | no |
| [`codacy`](skills/integrations/codacy/SKILL.md) | integrations | 2 | yes | 40 | 1,665 | user, model | yes | yes |
| [`codescene`](skills/integrations/codescene/SKILL.md) | integrations | 2 | yes | 34 | 1,697 | user, model | yes | yes |
| [`gitlab-ci-local`](skills/integrations/gitlab-ci-local/SKILL.md) | integrations | 2 | yes | 39 | 367 | user, model | yes | yes |
| [`glean`](skills/integrations/glean/SKILL.md) | integrations | 2 | yes | 44 | 859 | user, model | yes | yes |
| [`sourcegraph`](skills/integrations/sourcegraph/SKILL.md) | integrations | 2 | yes | 70 | 1,619 | user, model | yes | yes |
| [`code-review-and-quality`](skills/methodology/code-review-and-quality/SKILL.md) | methodology | 2 | yes | 60 | 2,809 | user, model | yes | yes |
| [`code-simplification`](skills/methodology/code-simplification/SKILL.md) | methodology | 2 | yes | 61 | 3,363 | user, model | yes | yes |
| [`codehome`](skills/methodology/codehome/SKILL.md) | methodology | 2 | no | 69 | 1,369 | user | no | no |
| [`context-engineering`](skills/methodology/context-engineering/SKILL.md) | methodology | 2 | yes | 50 | 2,773 | user, model | yes | yes |
| [`critical-thinking`](skills/methodology/critical-thinking/SKILL.md) | methodology | 2 | yes | 81 | 2,565 | user, model | yes | yes |
| [`dep-cost`](skills/methodology/dep-cost/SKILL.md) | methodology | 2 | yes | 95 | 1,938 | user, model | yes | yes |
| [`doubt-driven-development`](skills/methodology/doubt-driven-development/SKILL.md) | methodology | 2 | yes | 85 | 3,861 | user, model | yes | yes |
| [`external-tools`](skills/methodology/external-tools/SKILL.md) | methodology | 2 | yes | 59 | 750 | user, model | yes | yes |
| [`idea-refine`](skills/methodology/idea-refine/SKILL.md) | methodology | 2 | yes | 84 | 2,006 | user, model | yes | yes |
| [`incremental-implementation`](skills/methodology/incremental-implementation/SKILL.md) | methodology | 2 | yes | 56 | 2,314 | user, model | yes | yes |
| [`investigate-first`](skills/methodology/investigate-first/SKILL.md) | methodology | 2 | yes | 82 | 385 | user, model | yes | yes |
| [`loop-programming`](skills/methodology/loop-programming/SKILL.md) | methodology | 2 | yes | 115 | 2,431 | user, model | yes | yes |
| [`minimal-root-cause`](skills/methodology/minimal-root-cause/SKILL.md) | methodology | 2 | yes | 64 | 682 | user, model | yes | yes |
| [`modern-stack`](skills/methodology/modern-stack/SKILL.md) | methodology | 2 | yes | 44 | 1,546 | user, model | yes | yes |
| [`observability-and-instrumentation`](skills/methodology/observability-and-instrumentation/SKILL.md) | methodology | 2 | yes | 77 | 2,763 | user, model | yes | yes |
| [`one-shot-patch`](skills/methodology/one-shot-patch/SKILL.md) | methodology | 2 | yes | 68 | 346 | user, model | yes | yes |
| [`refactoring`](skills/methodology/refactoring/SKILL.md) | methodology | 2 | yes | 105 | 1,903 | user, model | yes | yes |
| [`repository-onboarding`](skills/methodology/repository-onboarding/SKILL.md) | methodology | 2 | yes | 99 | 1,789 | user, model | yes | yes |
| [`reuse-first`](skills/methodology/reuse-first/SKILL.md) | methodology | 2 | yes | 73 | 2,182 | user, model | yes | yes |
| [`review-methodology`](skills/methodology/review-methodology/SKILL.md) | methodology | 2 | yes | 84 | 1,101 | user, model | yes | yes |
| [`source-driven-development`](skills/methodology/source-driven-development/SKILL.md) | methodology | 2 | yes | 55 | 2,050 | user, model | yes | yes |
| [`spec-driven-development`](skills/methodology/sdd/spec-driven-development/SKILL.md) | methodology | 2 | yes | 51 | 2,211 | user, model | yes | yes |
| [`test-driven-development`](skills/methodology/test-driven-development/SKILL.md) | methodology | 2 | yes | 58 | 3,741 | user, model | yes | yes |
| [`handoff`](skills/orchestration/handoff/SKILL.md) | orchestration | 2 | yes | 91 | 3,009 | user, model | yes | yes |
| [`save-session`](skills/orchestration/save-session/SKILL.md) | orchestration | 2 | yes | 51 | 2,421 | user, model | yes | yes |
| [`subagent-capsule`](skills/orchestration/subagent-capsule/SKILL.md) | orchestration | 2 | yes | 79 | 518 | user, model | yes | yes |
| [`unwind`](skills/orchestration/unwind/SKILL.md) | orchestration | 2 | yes | 90 | 969 | user, model | yes | yes |
| [`using-agent-skills`](skills/orchestration/using-agent-skills/SKILL.md) | orchestration | 2 | yes | 55 | 2,516 | user, model | yes | yes |
| [`deepwiki`](skills/research/deepwiki/SKILL.md) | research | 2 | yes | 57 | 1,759 | user, model | yes | yes |
| [`external-research`](skills/research/external-research/SKILL.md) | research | 2 | yes | 113 | 1,337 | user, model | yes | yes |
| [`drill`](skills/safety/drill/SKILL.md) | safety | 2 | yes | 52 | 2,052 | user, model | yes | yes |
| [`safeguard`](skills/safety/safeguard/SKILL.md) | safety | 2 | yes | 98 | 1,447 | user, model | yes | yes |
| [`salvage`](skills/safety/salvage/SKILL.md) | safety | 2 | no | 74 | 647 | user | no | no |
| [`retrospect`](skills/self-learning/retrospect/SKILL.md) | self-learning | 2 | yes | 51 | 1,760 | user, model | yes | yes |
| [`skill-feedback`](skills/self-learning/skill-feedback/SKILL.md) | self-learning | 2 | yes | 116 | 1,815 | user, model | yes | yes |
| [`docker-agent-config`](skills/tools/docker-agent-config/SKILL.md) | tools | 2 | yes | 75 | 3,492 | user, model | yes | yes |
| [`npm-publish`](skills/tools/npm-publish/SKILL.md) | tools | 2 | yes | 76 | 2,063 | user, model | yes | yes |
| [`sarif-to-annotations`](skills/tools/sarif-to-annotations/SKILL.md) | tools | 2 | yes | 92 | 1,463 | user, model | yes | yes |
| [`skillmaker`](skills/tools/skillmaker/SKILL.md) | tools | 2 | yes | 43 | 1,513 | user, model | yes | yes |
| [`skills-cli`](skills/tools/skills-cli/SKILL.md) | tools | 2 | yes | 20 | 485 | user, model | yes | yes |
| [`tsdown`](skills/tools/tsdown/SKILL.md) | tools | 2 | yes | 52 | 767 | user, model | yes | yes |
| [`writing-great-skills`](skills/tools/writing-great-skills/SKILL.md) | tools | 2 | yes | 67 | 2,584 | user, model | yes | yes |
| [`debugging`](skills/troubleshooting/debugging/SKILL.md) | troubleshooting | 2 | yes | 109 | 1,771 | user, model | yes | yes |
| [`performance-investigation`](skills/troubleshooting/performance-investigation/SKILL.md) | troubleshooting | 2 | yes | 107 | 1,825 | user, model | yes | yes |
| [`evidence`](skills/verification/evidence/SKILL.md) | verification | 2 | partial | 85 | 2,734 | user, model | no | yes |
| [`evidence-lite`](skills/verification/evidence-lite/SKILL.md) | verification | 2 | yes | 76 | 637 | user, model | yes | yes |
| [`backlog`](skills/workflow/planning/backlog/SKILL.md) | workflow | 2 | yes | 26 | 628 | user, model | yes | yes |
| [`ci-cd-and-automation`](skills/workflow/ci-cd-and-automation/SKILL.md) | workflow | 2 | yes | 52 | 1,514 | user, model | yes | yes |
| [`ci-local`](skills/workflow/testing/ci-local/SKILL.md) | workflow | 2 | yes | 59 | 1,041 | user, model | yes | yes |
| [`deprecation-and-migration`](skills/workflow/deprecation-and-migration/SKILL.md) | workflow | 2 | yes | 52 | 3,131 | user, model | yes | yes |
| [`documentation-and-adrs`](skills/workflow/documentation-and-adrs/SKILL.md) | workflow | 2 | yes | 56 | 2,443 | user, model | yes | yes |
| [`e2e`](skills/workflow/testing/e2e/SKILL.md) | workflow | 2 | yes | 78 | 585 | user, model | yes | yes |
| [`git-commit`](skills/workflow/git/git-commit/SKILL.md) | workflow | 2 | yes | 83 | 1,072 | user, model | yes | yes |
| [`git-push`](skills/workflow/git/git-push/SKILL.md) | workflow | 2 | yes | 83 | 1,111 | user, model | yes | yes |
| [`git-reset`](skills/workflow/git/git-reset/SKILL.md) | workflow | 2 | yes | 66 | 1,428 | user, model | yes | yes |
| [`git-workflow-and-versioning`](skills/workflow/git/git-workflow-and-versioning/SKILL.md) | workflow | 2 | yes | 71 | 3,503 | user, model | yes | yes |
| [`harvest`](skills/workflow/debt/harvest/SKILL.md) | workflow | 2 | no | 107 | 2,016 | user | no | no |
| [`planning-and-task-breakdown`](skills/workflow/planning/planning-and-task-breakdown/SKILL.md) | workflow | 2 | yes | 60 | 1,908 | user, model | yes | yes |
| [`resolving-merge-conflicts`](skills/workflow/git/resolving-merge-conflicts/SKILL.md) | workflow | 2 | yes | 75 | 1,157 | user, model | yes | yes |
| [`shadow-fork`](skills/workflow/git/shadow-fork/SKILL.md) | workflow | 2 | yes | 64 | 1,650 | user, model | yes | yes |
| [`shared-plan`](skills/workflow/planning/shared-plan/SKILL.md) | workflow | 2 | yes | 63 | 656 | user, model | yes | yes |
| [`shipping-and-launch`](skills/workflow/shipping-and-launch/SKILL.md) | workflow | 2 | yes | 54 | 2,533 | user, model | yes | yes |

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
