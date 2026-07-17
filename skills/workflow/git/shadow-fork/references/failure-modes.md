# Failure Modes and Repairs

## fork/main is ahead of upstream/main

Meaning: the fork mirror branch contains commits that upstream does not have.

Action:

1. Stop review creation.
2. Show fork-only commits.
3. Do not force-reset automatically.
4. Ask for explicit repair intent if the user wants to discard those commits.

Safe repair options:

- If commits are accidental shadow merges, reset the fork branch to upstream only after explicit user approval.
- If commits are real work, move them to a feature branch before resetting the fork branch.

## fork/main diverged from upstream/main

Meaning: both branches contain unique commits.

Action:

1. Stop review creation.
2. Show commits only in upstream and only in fork.
3. Do not create PRs until fork main is repaired.

## fork/main is behind upstream/main

Meaning: fork main is stale but safe to update.

Action:

- Fast-forward fork main to upstream main.
- Re-check equality before creating reviews.

## Current branch is main

Meaning: user is trying to create reviews from the mirror branch.

Action:

- Stop.
- Ask the user to create or switch to a feature branch.

## Dirty working tree

Meaning: uncommitted changes may be excluded from the pushed feature branch or accidentally included after staging.

Action:

- Stop by default.
- Continue only if the user explicitly passes `--allow-dirty` and understands that only committed history is pushed.

## Personal-only review configuration in the diff

Examples:

- `.github/` workflow or app config intended only for the fork.
- `.gitlab/` templates intended only for the fork.
- Review-agent config files such as `.coderabbit.yaml`, `.cursor/`, `.aider*`, or similar local automation files.

Action:

- Warn before upstream PR/MR creation.
- Recommend moving personal review-agent setup to repository/app settings when possible.
- Do not claim comments sync across shadow and upstream reviews unless a separate comment-sync tool exists.

## Provider CLI missing or unauthenticated

Action:

- Use generic mode to validate and print manual instructions.
- Do not invent review URLs.
- Tell the user which CLI command failed and what authentication is likely needed.
