---
name: mr-address-review
description: End-to-end GitLab MR review-comment remediation. Use when the user asks to address, resolve, reply to, or work through MR review comments, especially commands like /mr address-review !3, /mr resolve-comments !3, or "fix all comments on this MR". Defaults to commit, push, reply, react, and resolve unless --dry-run is requested.
metadata:
  tier: 2
  triggers:
    - user
    - model
  source: theplenkov-ai/skills
---

# MR Address Review

Handle GitLab MR review comments as an operator workflow, not as loose local edits.

This skill turns requests like `/mr address-review !3` into a complete loop:
acknowledge review threads, evaluate feedback, implement fixes, verify, commit,
push, reply in each discussion, react with the final disposition, and resolve
settled threads.

## When to Use

- The user asks to address or resolve GitLab MR comments.
- The user uses a command-like phrase such as:
  - `/mr address-review !3`
  - `/mr resolve-comments !3`
  - `/mr fix-review !3`
  - `address MR review comments`
- The task requires taking an MR from unresolved reviewer findings to settled
  GitLab discussions.

## When NOT to Use

- The user asks to write a review on someone else's MR. Use `mr-review-buddy`.
- The user asks only to inspect MR status. Use $gitlab/$glab.
- The user passes `--dry-run`: still use this skill, but do not mutate GitLab,
  edit files, commit, push, or resolve discussions.

## Command Contract

Default command:

```text
/mr address-review !<iid>
```

Default behavior is end-to-end and mutating:

1. Fetch unresolved MR discussions.
2. Add `eyes` to each actionable reviewer comment before making changes.
3. Evaluate every finding against the codebase.
4. Implement accepted fixes and prepare technical pushback for rejected items.
5. Run relevant checks.
6. Commit and push changes to the MR branch.
7. Reply in every handled discussion.
8. Add `thumbsup` for accepted/fixed findings or `thumbsdown` for technical
   pushback.
9. Resolve settled discussions.
10. Re-fetch unresolved discussions and repeat until stable or blocked.

Dry run:

```text
/mr address-review !<iid> --dry-run
```

Dry-run behavior:

- Fetch and classify discussions only.
- Report intended fixes, pushbacks, checks, and likely files.
- Do not add reactions, edit files, commit, push, reply, or resolve.

`/mr resolve-comments !<iid>` is treated as an alias for
`/mr address-review !<iid>`, not as "resolve without fixing".

## Workflow

### 1. Parse MR Target

Accept either a full GitLab MR URL or an MR iid such as `!3`.

Resolve:

- project path from the URL or current `git remote`
- MR iid
- source branch
- current local branch

If the current branch is not the MR branch, fetch and switch only when it is
safe. Do not discard local changes. If unrelated dirty changes exist, either
work around them or stop with a concise blocker.

### 2. Fetch Review Discussions

Use `glab` with non-interactive mode:

```bash
GLAB_NO_PROMPT=true glab api "projects/<encoded-project>/merge_requests/<iid>/discussions"
```

Select unresolved actionable discussions:

```jq
.[] | select(.resolvable == true and .resolved == false)
```

Record for each:

- discussion id
- first note id
- author
- file/position if present
- full body
- whether it is actionable, clarification, or non-actionable

### 3. React With Eyes Before Work

For each actionable unresolved discussion, add `eyes` to the reviewer's note
before editing code:

```bash
GLAB_NO_PROMPT=true glab api -X POST \
  "projects/<project>/merge_requests/<iid>/notes/<note_id>/award_emoji" \
  -F name=eyes
```

If GitLab says the award already exists, treat that as success.

### 4. Evaluate Before Implementing

Apply code-review reception rules:

- Verify the suggestion against the current code.
- Accept feedback that improves correctness, diagnostics, safety, or clarity.
- Push back when the suggestion is wrong, unsafe, unnecessary, or contradicts
  project constraints.
- Ask a specific clarification if the request is ambiguous.

Do not write performative agreement or gratitude.

### 5. Implement Fixes

Make focused edits only for accepted review comments. Keep unrelated dirty
changes intact.

If multiple comments touch independent areas, implement them in one coherent
batch unless risk suggests separate commits.

### 6. Verify

Run the narrowest checks that prove the fixes:

- syntax checks for shell changes
- targeted TypeScript or package checks for TypeScript changes
- project test commands when behavior changes require them
- CI lint before committing CI config changes

If a relevant check cannot run locally, report the reason in the final summary
and MR replies.

### 7. Commit and Push by Default

Unless `--dry-run` is present, commit and push are part of the command.

Before committing:

- inspect `git status --short`
- stage only files related to the review work
- preserve unrelated user changes
- write a concise commit message from the actual diff

After committing, push the MR branch.

### 8. Reply, React, Resolve

For each accepted/fixed discussion, reply in-thread:

```text
Fixed in <short-sha>. <Specific one-sentence summary of the change>.
```

Then add `thumbsup` to the reviewer's note and resolve the discussion:

```bash
GLAB_NO_PROMPT=true glab api -X POST \
  "projects/<project>/merge_requests/<iid>/notes/<note_id>/award_emoji" \
  -F name=thumbsup

GLAB_NO_PROMPT=true glab api -X PUT \
  "projects/<project>/merge_requests/<iid>/discussions/<discussion_id>" \
  -F resolved=true
```

For technical pushback, reply with the reason, add `thumbsdown`, and leave the
discussion unresolved unless the reviewer has already acknowledged the decision.

For clarification requests, reply with the question and leave the discussion
unresolved.

### 9. Re-fetch and Report

After replies and resolves:

1. Re-fetch unresolved discussions.
2. Check pipeline/status if available.
3. Report:
   - commit SHA
   - pushed branch
   - checks run
   - discussions resolved
   - discussions still open and why

## GitLab API Notes

Always prefix `glab` commands:

```bash
GLAB_NO_PROMPT=true glab ...
```

Use `glab api` for discussion replies, award emoji, and resolution. Some
versions of `glab` do not support `--jq`; pipe JSON to `jq` instead.

For reply bodies containing backticks or multiline text, write a temp markdown
file and use:

```bash
GLAB_NO_PROMPT=true glab api -X POST \
  "projects/<project>/merge_requests/<iid>/discussions/<discussion_id>/notes" \
  -F body="@/tmp/reply.md"
```

## Output Style

Keep final output short and operational:

```text
Addressed MR !3 review comments.

Commit: <sha>
Pushed: <branch>
Checks: <commands>
Resolved: <n>
Still open: <n> (<reason>)
```

Do not include gratitude in MR replies. Use direct technical statements.
