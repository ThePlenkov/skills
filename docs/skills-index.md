# Skills Index

Auto-generated from skill frontmatter. Run `npx tsx scripts/generate-skills-index-md.ts` to regenerate.

## Summary

- **Total skills:** 96
- **Context window (default):** 128,000 tokens
- **Skills metadata budget (2%):** 2,560 tokens
- **Total description tokens:** 6,704 tokens
- **Overflow vs. 2% budget:** 2.62x
- **Total skill file tokens:** 180,949 tokens

Token counts use the same approximation Codex uses for its skills context budget: `ceil(byte_length / 4)`.

## By category

| Category | Skills | Description tokens | Total tokens |
| --- | --- | --- | --- |
| agents | 2 | 83 | 1,296 |
| behavior | 1 | 106 | 1,929 |
| coaching | 2 | 191 | 5,206 |
| code-review | 6 | 472 | 18,186 |
| engineering | 8 | 513 | 15,970 |
| experimentation | 1 | 101 | 1,717 |
| foundation | 4 | 320 | 9,112 |
| integrations | 10 | 476 | 10,857 |
| methodology | 23 | 1,657 | 49,103 |
| orchestration | 5 | 366 | 9,698 |
| research | 2 | 170 | 3,143 |
| safety | 3 | 224 | 4,629 |
| self-learning | 2 | 174 | 3,602 |
| tools | 7 | 425 | 12,542 |
| troubleshooting | 2 | 216 | 3,714 |
| verification | 2 | 161 | 3,479 |
| workflow | 16 | 1,049 | 26,766 |

## Skill catalog

| Skill | Category | Tier | Default enabled | Description tokens | Total tokens | Triggers | Claude model | Codex implicit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [`claude-skills`](skills/agents/claude-skills/SKILL.md) | agents | 2 | yes | 41 | 382 | user, model | yes | yes |
| [`dotagents`](skills/agents/dotagents/SKILL.md) | agents | 2 | yes | 42 | 914 | user, model | yes | yes |
| [`architecture-review`](skills/behavior/architecture-review/SKILL.md) | behavior | 2 | yes | 106 | 1,929 | user, model | yes | yes |
| [`adhd`](skills/coaching/adhd/SKILL.md) | coaching | 2 | yes | 69 | 1,575 | user, model | yes | yes |
| [`interview-me`](skills/coaching/interview-me/SKILL.md) | coaching | 2 | yes | 122 | 3,631 | user, model | yes | yes |
| [`act`](skills/code-review/act/SKILL.md) | code-review | 2 | yes | 116 | 7,635 | user, model | yes | yes |
| [`github-fix-main`](skills/code-review/github-fix-main/SKILL.md) | code-review | 2 | yes | 63 | 1,996 | user, model | yes | yes |
| [`github-pr-review`](skills/code-review/github-pr-review/SKILL.md) | code-review | 2 | yes | 29 | 2,357 | user, model | yes | yes |
| [`mr-address-review`](skills/code-review/mr-address-review/SKILL.md) | code-review | 2 | yes | 82 | 1,763 | user, model | yes | yes |
| [`triage-issue`](skills/code-review/triage-issue/SKILL.md) | code-review | 2 | yes | 65 | 1,631 | user, model | yes | yes |
| [`two-axis-review`](skills/code-review/two-axis-review/SKILL.md) | code-review | 2 | yes | 117 | 2,804 | user, model | yes | yes |
| [`api-and-interface-design`](skills/engineering/api-and-interface-design/SKILL.md) | engineering | 2 | yes | 63 | 2,600 | user, model | yes | yes |
| [`bootstrap-ts-repo`](skills/engineering/bootstrap-ts-repo/SKILL.md) | engineering | 2 | yes | 61 | 2,089 | user, model | yes | yes |
| [`frontend-ui-engineering`](skills/engineering/frontend-ui-engineering/SKILL.md) | engineering | 2 | yes | 77 | 2,697 | user, model | yes | yes |
| [`nodejs`](skills/engineering/nodejs/SKILL.md) | engineering | 2 | yes | 36 | 1,422 | user, model | yes | yes |
| [`performance-optimization`](skills/engineering/performance-optimization/SKILL.md) | engineering | 2 | yes | 74 | 2,935 | user, model | yes | yes |
| [`prototype`](skills/engineering/prototype/SKILL.md) | engineering | 2 | yes | 82 | 1,099 | user, model | yes | yes |
| [`security-and-hardening`](skills/engineering/security-and-hardening/SKILL.md) | engineering | 2 | yes | 62 | 2,012 | user, model | yes | yes |
| [`typescript`](skills/engineering/typescript/SKILL.md) | engineering | 2 | yes | 58 | 1,116 | user, model | yes | yes |
| [`sandboxed`](skills/experimentation/sandboxed/SKILL.md) | experimentation | 2 | yes | 101 | 1,717 | user, model | yes | yes |
| [`minimalist`](skills/foundation/minimalist/SKILL.md) | foundation | 2 | yes | 124 | 3,541 | user, model | yes | yes |
| [`persistent-memory`](skills/foundation/persistent-memory/SKILL.md) | foundation | 1 | no | 78 | 2,452 | user | no | no |
| [`skill-tiers`](skills/foundation/skill-tiers/SKILL.md) | foundation | 2 | yes | 55 | 1,116 | user, model | yes | yes |
| [`token-rationalism`](skills/foundation/token-rationalism/SKILL.md) | foundation | 0 | always | 63 | 2,003 | always | yes | yes |
| [`atlassian`](skills/integrations/atlassian/SKILL.md) | integrations | 2 | yes | 58 | 262 | user, model | yes | yes |
| [`bootstrap-gh-self-hosted-runner`](skills/integrations/bootstrap-gh-self-hosted-runner/SKILL.md) | integrations | 2 | no | 44 | 2,388 | user | no | no |
| [`codacy`](skills/integrations/codacy/SKILL.md) | integrations | 2 | yes | 40 | 1,686 | user, model | yes | yes |
| [`codescene`](skills/integrations/codescene/SKILL.md) | integrations | 2 | yes | 34 | 1,718 | user, model | yes | yes |
| [`github`](skills/integrations/github/SKILL.md) | integrations | 2 | yes | 54 | 934 | user, model | yes | yes |
| [`gitlab`](skills/integrations/gitlab/SKILL.md) | integrations | 2 | yes | 60 | 308 | user, model | yes | yes |
| [`gitlab-ci-local`](skills/integrations/gitlab-ci-local/SKILL.md) | integrations | 2 | yes | 39 | 380 | user, model | yes | yes |
| [`glab`](skills/integrations/glab/SKILL.md) | integrations | 2 | yes | 33 | 584 | user, model | yes | yes |
| [`glean`](skills/integrations/glean/SKILL.md) | integrations | 2 | yes | 44 | 881 | user, model | yes | yes |
| [`sourcegraph`](skills/integrations/sourcegraph/SKILL.md) | integrations | 2 | yes | 70 | 1,716 | user, model | yes | yes |
| [`code-review-and-quality`](skills/methodology/code-review-and-quality/SKILL.md) | methodology | 2 | yes | 60 | 2,841 | user, model | yes | yes |
| [`code-simplification`](skills/methodology/code-simplification/SKILL.md) | methodology | 2 | yes | 61 | 3,384 | user, model | yes | yes |
| [`codehome`](skills/methodology/codehome/SKILL.md) | methodology | 2 | no | 69 | 1,482 | user | no | no |
| [`context-engineering`](skills/methodology/context-engineering/SKILL.md) | methodology | 2 | yes | 50 | 2,794 | user, model | yes | yes |
| [`critical-thinking`](skills/methodology/critical-thinking/SKILL.md) | methodology | 2 | yes | 81 | 2,587 | user, model | yes | yes |
| [`dep-cost`](skills/methodology/dep-cost/SKILL.md) | methodology | 2 | yes | 95 | 1,938 | user, model | yes | yes |
| [`doubt-driven-development`](skills/methodology/doubt-driven-development/SKILL.md) | methodology | 2 | yes | 85 | 3,899 | user, model | yes | yes |
| [`idea-refine`](skills/methodology/idea-refine/SKILL.md) | methodology | 2 | yes | 84 | 2,028 | user, model | yes | yes |
| [`incremental-implementation`](skills/methodology/incremental-implementation/SKILL.md) | methodology | 2 | yes | 56 | 2,346 | user, model | yes | yes |
| [`investigate-first`](skills/methodology/investigate-first/SKILL.md) | methodology | 2 | yes | 82 | 460 | user, model | yes | yes |
| [`loop-programming`](skills/methodology/loop-programming/SKILL.md) | methodology | 2 | yes | 115 | 2,499 | user, model | yes | yes |
| [`minimal-root-cause`](skills/methodology/minimal-root-cause/SKILL.md) | methodology | 2 | yes | 64 | 745 | user, model | yes | yes |
| [`modern-stack`](skills/methodology/modern-stack/SKILL.md) | methodology | 2 | yes | 44 | 1,590 | user, model | yes | yes |
| [`observability-and-instrumentation`](skills/methodology/observability-and-instrumentation/SKILL.md) | methodology | 2 | yes | 77 | 2,785 | user, model | yes | yes |
| [`one-shot-patch`](skills/methodology/one-shot-patch/SKILL.md) | methodology | 2 | yes | 68 | 409 | user, model | yes | yes |
| [`refactoring`](skills/methodology/refactoring/SKILL.md) | methodology | 2 | yes | 105 | 1,953 | user, model | yes | yes |
| [`repository-onboarding`](skills/methodology/repository-onboarding/SKILL.md) | methodology | 2 | yes | 99 | 1,836 | user, model | yes | yes |
| [`reuse-first`](skills/methodology/reuse-first/SKILL.md) | methodology | 2 | yes | 73 | 2,180 | user, model | yes | yes |
| [`review-methodology`](skills/methodology/review-methodology/SKILL.md) | methodology | 2 | yes | 84 | 1,121 | user, model | yes | yes |
| [`source-driven-development`](skills/methodology/source-driven-development/SKILL.md) | methodology | 2 | yes | 55 | 2,071 | user, model | yes | yes |
| [`spec-driven-development`](skills/methodology/sdd/spec-driven-development/SKILL.md) | methodology | 2 | yes | 51 | 2,173 | user, model | yes | yes |
| [`spec-kit`](skills/methodology/sdd/spec-kit/SKILL.md) | methodology | 2 | yes | 41 | 2,219 | user, model | yes | yes |
| [`test-driven-development`](skills/methodology/test-driven-development/SKILL.md) | methodology | 2 | yes | 58 | 3,763 | user, model | yes | yes |
| [`handoff`](skills/orchestration/handoff/SKILL.md) | orchestration | 2 | yes | 91 | 3,141 | user, model | yes | yes |
| [`save-session`](skills/orchestration/save-session/SKILL.md) | orchestration | 2 | yes | 51 | 2,291 | user, model | yes | yes |
| [`subagent-capsule`](skills/orchestration/subagent-capsule/SKILL.md) | orchestration | 2 | yes | 79 | 562 | user, model | yes | yes |
| [`unwind`](skills/orchestration/unwind/SKILL.md) | orchestration | 2 | yes | 90 | 1,098 | user, model | yes | yes |
| [`using-agent-skills`](skills/orchestration/using-agent-skills/SKILL.md) | orchestration | 2 | yes | 55 | 2,606 | user, model | yes | yes |
| [`deepwiki`](skills/research/deepwiki/SKILL.md) | research | 2 | yes | 57 | 1,780 | user, model | yes | yes |
| [`external-research`](skills/research/external-research/SKILL.md) | research | 2 | yes | 113 | 1,363 | user, model | yes | yes |
| [`drill`](skills/safety/drill/SKILL.md) | safety | 2 | yes | 52 | 2,071 | user, model | yes | yes |
| [`safeguard`](skills/safety/safeguard/SKILL.md) | safety | 2 | yes | 98 | 1,688 | user, model | yes | yes |
| [`salvage`](skills/safety/salvage/SKILL.md) | safety | 2 | no | 74 | 870 | user | no | no |
| [`retrospect`](skills/self-learning/retrospect/SKILL.md) | self-learning | 2 | yes | 51 | 1,781 | user, model | yes | yes |
| [`skill-feedback`](skills/self-learning/skill-feedback/SKILL.md) | self-learning | 2 | yes | 123 | 1,821 | user, model | yes | yes |
| [`docker-agent-config`](skills/tools/docker-agent-config/SKILL.md) | tools | 2 | yes | 75 | 3,513 | user, model | yes | yes |
| [`npm-publish`](skills/tools/npm-publish/SKILL.md) | tools | 2 | yes | 76 | 2,116 | user, model | yes | yes |
| [`sarif-to-annotations`](skills/tools/sarif-to-annotations/SKILL.md) | tools | 2 | yes | 92 | 1,484 | user, model | yes | yes |
| [`skillmaker`](skills/tools/skillmaker/SKILL.md) | tools | 2 | yes | 43 | 1,452 | user, model | yes | yes |
| [`skills-cli`](skills/tools/skills-cli/SKILL.md) | tools | 2 | yes | 20 | 506 | user, model | yes | yes |
| [`tsdown`](skills/tools/tsdown/SKILL.md) | tools | 2 | yes | 52 | 811 | user, model | yes | yes |
| [`writing-great-skills`](skills/tools/writing-great-skills/SKILL.md) | tools | 2 | yes | 67 | 2,660 | user, model | yes | yes |
| [`debugging`](skills/troubleshooting/debugging/SKILL.md) | troubleshooting | 2 | yes | 109 | 1,839 | user, model | yes | yes |
| [`performance-investigation`](skills/troubleshooting/performance-investigation/SKILL.md) | troubleshooting | 2 | yes | 107 | 1,875 | user, model | yes | yes |
| [`evidence`](skills/verification/evidence/SKILL.md) | verification | 2 | yes | 85 | 2,783 | user, model | yes | yes |
| [`evidence-lite`](skills/verification/evidence-lite/SKILL.md) | verification | 2 | yes | 76 | 696 | user, model | yes | yes |
| [`backlog`](skills/workflow/planning/backlog/SKILL.md) | workflow | 2 | yes | 26 | 650 | user, model | yes | yes |
| [`ci-cd-and-automation`](skills/workflow/ci-cd-and-automation/SKILL.md) | workflow | 2 | yes | 52 | 1,536 | user, model | yes | yes |
| [`ci-local`](skills/workflow/testing/ci-local/SKILL.md) | workflow | 2 | yes | 59 | 1,063 | user, model | yes | yes |
| [`deprecation-and-migration`](skills/workflow/deprecation-and-migration/SKILL.md) | workflow | 2 | yes | 52 | 3,152 | user, model | yes | yes |
| [`documentation-and-adrs`](skills/workflow/documentation-and-adrs/SKILL.md) | workflow | 2 | yes | 56 | 2,464 | user, model | yes | yes |
| [`e2e`](skills/workflow/testing/e2e/SKILL.md) | workflow | 2 | yes | 78 | 603 | user, model | yes | yes |
| [`git-commit`](skills/workflow/git/git-commit/SKILL.md) | workflow | 2 | yes | 83 | 1,094 | user, model | yes | yes |
| [`git-push`](skills/workflow/git/git-push/SKILL.md) | workflow | 2 | yes | 83 | 1,133 | user, model | yes | yes |
| [`git-reset`](skills/workflow/git/git-reset/SKILL.md) | workflow | 2 | yes | 66 | 1,459 | user, model | yes | yes |
| [`git-workflow-and-versioning`](skills/workflow/git/git-workflow-and-versioning/SKILL.md) | workflow | 2 | yes | 71 | 3,524 | user, model | yes | yes |
| [`harvest`](skills/workflow/debt/harvest/SKILL.md) | workflow | 2 | no | 107 | 2,025 | user | no | no |
| [`planning-and-task-breakdown`](skills/workflow/planning/planning-and-task-breakdown/SKILL.md) | workflow | 2 | yes | 60 | 1,930 | user, model | yes | yes |
| [`resolving-merge-conflicts`](skills/workflow/git/resolving-merge-conflicts/SKILL.md) | workflow | 2 | yes | 75 | 1,229 | user, model | yes | yes |
| [`shadow-fork`](skills/workflow/git/shadow-fork/SKILL.md) | workflow | 2 | yes | 64 | 1,672 | user, model | yes | yes |
| [`shared-plan`](skills/workflow/planning/shared-plan/SKILL.md) | workflow | 2 | yes | 63 | 677 | user, model | yes | yes |
| [`shipping-and-launch`](skills/workflow/shipping-and-launch/SKILL.md) | workflow | 2 | yes | 54 | 2,555 | user, model | yes | yes |

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
