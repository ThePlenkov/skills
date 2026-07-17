# Provider Adapters

## Shared git layer

The branch safety checks are provider-neutral:

```bash
git fetch upstream main
git fetch origin main
```

Then compare:

- Equal: safe to proceed.
- Fork behind upstream: fast-forward fork branch from upstream.
- Fork ahead upstream: block.
- Fork diverged from upstream: block.

The bundled `scripts/sync-main` implements this without checking out or rewriting the local branch.

## GitHub adapter

Use GitHub CLI when `--provider github` is selected.

Shadow PR:

```bash
gh pr create \
  --repo user/project \
  --base main \
  --head feature-x \
  --title "feature-x" \
  --body-file shadow-body.md \
  --draft
```

Upstream PR:

```bash
gh pr create \
  --repo org/project \
  --base main \
  --head user:feature-x \
  --title "feature-x" \
  --body-file upstream-body.md
```

Cross-link:

```bash
gh pr edit <shadow-pr-url> --repo user/project --body-file shadow-body-linked.md
gh pr edit <upstream-pr-url> --repo org/project --body-file upstream-body-linked.md
```

Provider caveat: GitHub CLI uses `<user>:<branch>` for the upstream PR head. If the fork owner cannot be represented this way in the current environment, use generic mode and create the upstream PR manually.

## GitLab adapter

Use GitLab CLI when `--provider gitlab` is selected.

Shadow MR:

```bash
glab mr create \
  --repo user/project \
  --source-branch feature-x \
  --target-branch main \
  --title "feature-x" \
  --description "$(cat shadow-body.md)" \
  --draft \
  --yes
```

Upstream MR:

```bash
glab mr create \
  --repo group/project \
  --head user/project \
  --source-branch feature-x \
  --target-branch main \
  --title "feature-x" \
  --description "$(cat upstream-body.md)" \
  --yes
```

Cross-link with `glab mr update` when the MR internal IDs can be parsed from the returned URLs.

## Generic adapter

Generic mode is for other git hosts or unsupported CLIs. It still performs the safe git sync and branch push, then writes body files to a temporary directory and prints manual review targets:

```text
Shadow review:
  head: fork/repo:feature-x
  base: fork/repo:main

Upstream review:
  head: fork/repo:feature-x
  base: upstream/repo:main
```

Use this mode for Bitbucket, Forgejo, Gitea, Gerrit-like flows, or any environment where the assistant cannot safely call a provider-specific review API.
