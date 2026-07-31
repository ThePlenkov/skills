---
name: mr-address-review
description: Deprecated alias for /act. Use /act to address code-review feedback on GitHub or GitLab.
---

# MR Address Review

Use `$skill{act}` (`/act`) for all review-comment remediation. `/act`
supports both GitHub pull requests and GitLab merge requests with the same
methodology.

This skill is kept as a routing alias so existing commands like
`/mr address-review !3` continue to work; the actual workflow is handled by
`/act`.
