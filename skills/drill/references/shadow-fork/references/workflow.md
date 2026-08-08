# Shadow Fork Workflow

## Lifecycle

1. Start from upstream default branch.
2. Ensure fork default branch is equal to upstream default branch.
3. Create or update a feature branch in the personal fork.
4. Create a shadow review into the fork default branch.
5. Create an upstream review into the upstream default branch.
6. Push all review fixes to the same fork feature branch.
7. Merge only the upstream review unless the user explicitly chooses a different policy.
8. After upstream merge, sync the fork default branch from upstream again.
9. Close the shadow review as superseded or keep it for history according to user preference.
10. Delete the feature branch only after both review requests are resolved.

## Branch roles

`upstream/main` is canonical.

`fork/main` is a mirror branch. It may be behind upstream temporarily, but it must not be ahead or diverged.

`fork/feature` is the development branch and the single source of truth for both review requests.

## Default merge policy

Do not merge the shadow review first. The shadow review exists to trigger personal namespace checks, personal review agents, and a separate review loop. The upstream review is the canonical integration path.

Preferred cleanup after upstream merge:

```text
upstream review merged
-> sync fork/main from upstream/main
-> close shadow review as superseded by upstream merge
-> delete feature branch after checks are no longer needed
```

## Review body template

Use this block in both review descriptions:

```markdown
## Shadow Fork Workflow

This review was created from the same source branch as its paired review request.

- Source branch: `fork/repo:feature-branch`
- Base branch: `main`
- Shadow target: `fork/repo:main`
- Upstream target: `upstream/repo:main`
- Paired review: <url>

Rules:
- Treat `fork/repo:main` as a mirror of `upstream/repo:main`.
- Do not push feature commits directly to `fork/repo:main`.
- Do not merge the shadow review before the upstream review unless explicitly overriding the workflow.
- New commits must be pushed to `fork/repo:feature-branch`; both reviews update from that same head branch.
```

## Pre-PR checklist

- Local checkout is not on the base branch.
- Working tree is clean.
- `upstream` remote points to the canonical repository.
- `origin` or fork remote points to the personal fork.
- `fork/main` has been synced from `upstream/main`.
- `fork/main == upstream/main` after sync.
- Feature branch has no personal-only review-agent config files unless intentionally part of the upstream change.
