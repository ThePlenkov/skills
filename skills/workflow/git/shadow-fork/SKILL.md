---
name: shadow-fork
description: "enforce a provider-neutral shadow fork workflow: develop upstream repos through a personal fork, keep fork main synced as a mirror, and create paired shadow/upstream review requests from one feature branch. supports github, gitlab, and generic git hosts."
tier: 2
triggers: [user, model]
source: theplenkov-ai/skills
---

# Shadow Fork

Use this skill to manage a dual-review workflow where all development happens on a feature branch in a personal fork, while the fork default branch remains a mirror of the upstream default branch.

## Core model

- Upstream repository: `upstream/repo`
- Personal fork: `fork/repo`
- Upstream base branch: `upstream/repo:main`
- Fork mirror branch: `fork/repo:main`
- Feature source branch: `fork/repo:feature-branch`

Create two review requests from the same source branch:

1. Shadow review: `fork/repo:feature-branch -> fork/repo:main`
2. Upstream review: `fork/repo:feature-branch -> upstream/repo:main`

The feature branch is the single source of truth. New commits pushed to that branch update both reviews.

## Non-negotiable invariants

- Treat the fork default branch as a downstream mirror, not a development branch.
- Always sync the fork default branch from the upstream default branch before creating any review request.
- Do not create review requests unless `fork/main == upstream/main` after sync.
- Stop if `fork/main` is ahead of `upstream/main`.
- Stop if `fork/main` has diverged from `upstream/main`.
- Never push feature commits directly to `fork/main`.
- Never merge the shadow review before the upstream review unless the user explicitly overrides this rule.
- Cross-link the shadow and upstream reviews whenever the provider supports editing review bodies.

## Workflow decision tree

1. User asks to check or repair fork main sync:
   - Use `npx tsx scripts/run.ts .agents/skills/shadow-fork/scripts/sync-main`.
2. User asks to create paired shadow/upstream PRs or MRs:
   - Use `npx tsx scripts/run.ts .agents/skills/shadow-fork/scripts/shadow-pr`; it runs `sync-main` first.
3. User is on an unsupported host or no hosting CLI is available:
   - Use `npx tsx scripts/run.ts .agents/skills/shadow-fork/scripts/shadow-pr --provider generic` to validate git state, sync/push when possible, and print manual review instructions.
4. User asks conceptual or policy questions:
   - Answer using the invariants above and the reference docs.

## Required information

Before creating reviews, determine:

- Provider: `github`, `gitlab`, or `generic`.
- Upstream repo slug or URL, for example `org/project` or `group/project`.
- Fork repo slug or URL, for example `user/project`.
- Upstream remote name, usually `upstream`.
- Fork remote name, usually `origin`.
- Base/default branch, usually `main`.
- Feature branch, usually the current branch.
- Title and optional body.

Infer these from git remotes and current branch when safe. Ask only when a missing value would make the target repositories ambiguous.

## Script usage

Run bundled scripts from a local git checkout with the user's authenticated git remotes and provider CLI available.

### Sync fork main only

```bash
npx tsx scripts/run.ts .agents/skills/shadow-fork/scripts/sync-main \
  --upstream-remote upstream \
  --fork-remote origin \
  --branch main
```

This fetches both remotes, compares remote tracking branches, and only fast-forwards the fork branch when it is behind upstream. It hard-stops when the fork branch is ahead or diverged.

Use dry-run when preparing a command plan:

```bash
npx tsx scripts/run.ts .agents/skills/shadow-fork/scripts/sync-main --upstream-remote upstream --fork-remote origin --branch main --dry-run
```

### Create paired reviews

GitHub:

```bash
npx tsx scripts/run.ts .agents/skills/shadow-fork/scripts/shadow-pr \
  --provider github \
  --upstream-repo org/project \
  --fork-repo user/project \
  --branch main \
  --feature-branch feature-x \
  --title "feature-x"
```

GitLab:

```bash
npx tsx scripts/run.ts .agents/skills/shadow-fork/scripts/shadow-pr \
  --provider gitlab \
  --upstream-repo group/project \
  --fork-repo user/project \
  --branch main \
  --feature-branch feature-x \
  --title "feature-x"
```

Generic host/manual mode:

```bash
npx tsx scripts/run.ts .agents/skills/shadow-fork/scripts/shadow-pr \
  --provider generic \
  --upstream-repo upstream/project \
  --fork-repo user/project \
  --branch main \
  --feature-branch feature-x \
  --title "feature-x"
```

Defaults:

- Shadow review is draft by default.
- Upstream review is ready by default unless `--draft-upstream` is passed.
- Working tree must be clean unless `--allow-dirty` is passed.
- Suspicious personal review-agent config files in the upstream diff block creation unless `--allow-personal-config` is passed.
- `shadow-pr` always runs `sync-main` before pushing the feature branch or creating reviews.

## Provider behavior

- Git sync and ahead/divergence checks are provider-neutral and use only `git`.
- GitHub review creation uses `gh pr create` and cross-linking uses `gh pr edit`.
- GitLab review creation uses `glab mr create` and cross-linking uses `glab mr update` when MR IDs can be parsed.
- Generic mode does not call hosting APIs; it prints exact head/base pairs and body files for manual creation.

See `references/provider-adapters.md` for provider-specific command details.

## Stop conditions

Stop and report the exact reason before creating reviews if:

- The current branch is the base branch.
- The working tree is dirty and the user did not opt into `--allow-dirty`.
- The upstream or fork remote is missing.
- The base branch cannot be fetched from either remote.
- The fork base branch is ahead of upstream.
- The fork base branch has diverged from upstream.
- Provider CLI authentication is missing.
- The diff appears to include personal-only review-agent configuration that should not reach upstream.

Use `references/failure-modes.md` for repair guidance.

## Output format

After a successful operation, report:

```text
Shadow review: <url or manual target>
Upstream review: <url or manual target>
Source branch: <fork repo>:<feature branch>
Base sync: fork/main == upstream/main before creation
Warnings: <none or specific warnings>
```

When blocked, report:

```text
Blocked: <specific invariant violated>
Evidence: <commits, branch comparison, or command output>
Next action: <safe repair step>
```

## References

- `references/workflow.md`: full lifecycle and merge/cleanup policy.
- `references/provider-adapters.md`: GitHub, GitLab, and generic host behavior.
- `references/failure-modes.md`: common blocked states and repairs.
