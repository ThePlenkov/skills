---
name: triage-issue
description: Triage a GitLab or GitHub issue end-to-end — acknowledge, investigate, fix or retest, verify, and report back on the issue. Use when the user asks to triage an issue/work item, says "/triage-issue", or pastes an issue URL with an implicit ask to handle it.
---

# Triage Issue

Act as the first responder on an incoming issue. Do not just summarize — *work it* until the reporter has something actionable (a verified resolution, a fix branch, or a precise next step).

## When to Use

- The user pastes a GitLab or GitHub issue / work-item URL and asks to triage, investigate, or handle it.
- The user says `/triage-issue` or similar.
- A colleague reports a pipeline / CI failure and expects someone to take it from here.

## When NOT to Use

- The user only wants a summary of the issue (use $skill{external-tools} / $skill{external-tools} directly).
- The issue is a feature request or discussion with no concrete failure — just comment and hand back.
- The user explicitly wants a code review, not triage (use $skill{act} / $skill{github-pr-review}).

## Principles

- **Announce before you dig.** Post a short acknowledgement comment so the reporter knows the issue is picked up.
- **Root cause over symptom.** Read logs/traces until you can explain *why*, not just *what* failed.
- **Check if already fixed.** Before proposing a new fix, search recent commits / merged PRs for the same symptom upstream.
- **Close the loop on the issue itself.** Every meaningful step gets a comment on the issue, not just in chat.
- **Ship something.** The triage ends with either (a) a verified green run and a closed issue, or (b) a draft PR/MR with the fix and a link back on the issue.

## Workflow

### 1. Fetch context

Identify the platform from the URL. Use the appropriate skill:

- GitLab → `$skill{external-tools}` / `$skill{external-tools}` (`glab api`, `glab issue view`, `glab ci trace`).
- GitHub → `$skill{external-tools}` (`gh issue view`, `gh run view`, `gh pr view`).

Pull: issue title/body, labels, assignees, linked MR/PR, latest pipeline / workflow run, failing job traces.

### 2. Acknowledge on the issue

Post a short comment so the reporter sees traction. Keep it factual; no promises on ETA.

> 👀 Picking this up. Will investigate the failing pipeline and report back.

### 3. Investigate

For CI failures:

- Find the failing job in the latest pipeline.
- Pull its trace (`glab ci trace <job-id>` or `gh run view <run-id> --log-failed`).
- Grep the trace for the actual error line (past the usual noise).

For behavioral bugs:

- Identify the component / file from the report.
- Use `$blame-trace` to find the commit that introduced the suspected code.
- Read related tests or recent PRs in the area.

### 4. Check for upstream fix

Before writing new code:

- Search recent commits on the default branch for the symptom string / error message.
- Check merged PRs/MRs in the last 2–4 weeks for the same area.
- If a fix already landed, the reporter's pipeline likely ran against an older ref.

### 5. Act

**Case A — already fixed upstream:**

1. Retrigger the reporter's pipeline (or the entry point that created it).
2. Wait for completion and inspect the result.
3. If green: post verification comment with pipeline link + explanation + close the issue.
4. If still red: fall through to Case B.

**Case B — new fix needed:**

1. Create a branch, implement the minimal fix.
2. Add or update a test that reproduces the failure.
3. Verify locally (run tests / lint / relevant `test-local.sh`).
4. Push and open a **draft** PR/MR (`$split-draft-mrs` or `gh pr create --draft` / `glab mr create --draft`).
5. Link the PR/MR from the issue with a comment explaining cause and fix.
6. Leave the issue open until the PR/MR merges and a re-run passes.

**Case C — cannot reproduce / not enough info:**

1. Post a comment asking for the missing data (logs, env, repro steps, expected vs actual).
2. Assign the issue back to the reporter.
3. Stop — do not escalate further until they respond.

### 6. Housekeeping

- Assign the issue to yourself (or the owner actually working it) so it's not unassigned.
- Apply labels if the project has a label scheme (`bug`, `ci`, `resolved-upstream`, etc.).
- Skip label assignment if the project has none defined — don't invent labels.

## Comment templates

### Acknowledgement (step 2)

```markdown
👀 Picking this up. Will investigate the failing <pipeline|workflow> and report back.
```

### Triage result — already fixed upstream

```markdown
## Triage

**Failing job:** [<job-name> in pipeline <id>](<url>)
**Symptom:** `<one-line error>`

**Cause:** <root cause explanation>. Same issue as <commit-link>, already fixed upstream.

**Next step:** Retriggered the pipeline — will follow up once verified.
```

### Verification — green and closing

```markdown
## ✅ Verified — issue resolved

Retriggered pipeline: [<new-pipeline-id>](<url>) — all jobs passed.

Trace snippet confirming the fix:

<short code block>

Closing this issue.
```

### New fix in flight

```markdown
## Triage

**Cause:** <root cause>.

**Fix:** [<PR/MR draft>](<url>) — adds <change> and a regression test. Will self-review and flip out of draft once CI is green.
```

### Need more info

```markdown
Thanks for the report. To reproduce I need:

- [ ] Full pipeline/run URL
- [ ] Exact command you ran / step you clicked
- [ ] Branch / commit SHA

Reassigning back to you for now.
```

## Tools & references

- `$skill{external-tools}` / `$skill{external-tools}` — GitLab CLI (`glab api`, `glab issue note`, `glab ci trace`, `glab mr create --draft`).
- `$skill{external-tools}` — GitHub CLI (`gh issue view`, `gh issue comment`, `gh run view`, `gh pr create --draft`).
- `$blame-trace` — find the commit that introduced the suspected code.
- `$split-draft-mrs` — when the fix is large enough that stacked draft MRs make sense.
- `$mr-description-writer` / `$mr-review-buddy` — for the PR/MR body after the fix is pushed.

## Anti-patterns

- Answering only in chat and never commenting on the issue.
- Closing the issue before the reporter's original pipeline/run goes green.
- Pushing a fix directly to `main` instead of a draft PR/MR.
- Inventing labels that don't exist in the project.
- Triaging without acknowledging first — the reporter doesn't know someone's on it.
