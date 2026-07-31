---
name: github-pr-review
description: Use when the user asks for a GitHub pull request review or wants review comments prepared for a PR on github.com.
---

# GitHub Pull Request Review

Review a GitHub PR the way a senior reviewer does: understand intent, inspect the diff for real risk, and return findings prioritised by severity. Use `gh` CLI for everything — never screen-scrape the UI.

## Scope (not to be confused with)

- `$skill{two-axis-review}` — two-axis review methodology; use when you want parallel Standards + Spec reviews rather than a single reviewer pass.
- `$skill{act}` — handling comments left on a PR/MR you own (react → evaluate → reply → resolve). Different direction.
- `$skill{code-review-and-quality}` — rubric for evaluating feedback you got (agree / partial / disagree). Not about writing a review.

This skill is: **you are the reviewer, the PR lives on GitHub, you produce a review.**

## Invocation

```
/github-pr-review [--repo OWNER/REPO] [--pr NUMBER]
```

If the options are missing and there is exactly one open PR referenced in the conversation, use it. Otherwise ask plainly in chat for `--repo` and `--pr`.

## Workflow

### 1. Gather context in parallel

All four commands are read-only and safe to batch:

```bash
node -e "require('fs').mkdirSync('tmp', { recursive: true })"
gh pr view     <N> --repo <OWNER/REPO> --json \
  title,body,state,mergeable,baseRefName,headRefName,\
isDraft,author,labels,additions,deletions,changedFiles,\
files,reviews,reviewDecision                                # PR metadata
gh pr diff     <N> --repo <OWNER/REPO> > tmp/pr.diff       # the diff
gh pr checks   <N> --repo <OWNER/REPO>                      # CI status
gh pr view     <N> --repo <OWNER/REPO> --comments           # existing threads
```

Don't start reviewing until these have come back.

### 2. Establish intent

From the PR title + body + linked issues:

- What is this PR supposed to do?
- What is the user-visible effect?
- What tests or evidence back it up?

If intent is unclear, ask the PR author in chat before inspecting the diff. A review anchored on wrong intent wastes everyone's time.

### 3. Read prior signal — don't duplicate bots

Before reading a single hunk, look at what the automated reviewers already said. On a typical GitHub PR the following may have already left comments / check-run annotations:

- **CodeRabbit / Devin Review** — AI reviewers; they tend to catch style and obvious bugs.
- **SonarCloud / CodeQL / Snyk** — static analysis; findings show up both as a check and as inline annotations.
- **Codecov / Coveralls** — test coverage deltas.
- **The project's own CI** (`gh pr checks`).

If a bot has already flagged finding X, **do not re-raise X**. Either endorse it briefly in your summary or stay silent. Human review value is in the things a bot cannot see: intent, architecture, domain correctness, test adequacy.

### 4. Inspect the diff

Walk the diff in passes, not linearly:

1. **Correctness & regressions** — off-by-one, nullability, async/race, error paths, loop bounds, security-sensitive string handling.
2. **Data safety** — anything that drops, overwrites, or migrates data. Flag destructive operations unconditionally.
3. **Public API surface** — any change to exported types, CLI flags, HTTP endpoints, config keys. Is it backwards compatible? Is it versioned?
4. **Tests** — does new behaviour have a test? Does a bugfix have a regression test? Are skipped/commented tests creeping in?
5. **Performance / compatibility** — only when the diff touches hot paths, platform APIs, or supported runtime/node/browser versions.
6. **Style** — only flag style if it actually hides a bug. Otherwise it's noise.

For diffs over ~1000 lines, batch your review by subsystem (e.g. "lib/", "tests/", "workflows/") so each batch stays focused. The GitHub PR page already groups by file; mirror that.

### 5. Verify the "green CI" claim

`gh pr checks` shows passing checks but doesn't prove correctness. Check that:

- The right checks ran (typecheck, lint, tests for the changed packages).
- `nx affected -t test` (or equivalent) actually ran for this change and didn't short-circuit.
- Any check marked "skipping" isn't the one that should have validated the risky part.

If a check should have fired but didn't, raise that as a finding.

### 6. Produce the report (in chat)

Return markdown with these sections (drop sections that are empty):

```
## Review
<one-paragraph summary: is CI green, scope, confidence level>

### Files changed summary
<counts by rule / category, or subsystem breakdown for large PRs>

### Findings

#### Blocking
- <file:line> — <what's wrong + what to do>

#### Important — not blocking merge
- ...

#### Low — nits / follow-ups
- ...

### Positive observations
- <what's actually done well>

### Open questions
- <things the author should clarify before merge>

### Recommendation
**Approve / Request changes / Comment only** + one sentence why.
```

Use file:line references everywhere — never "in the publish job somewhere". If a finding needs more than two sentences, it's probably two findings.

## Severity rubric

| Severity | Meaning |
|----------|---------|
| **Blocking** | Ship this as-is → incident, data loss, security bug, or broken release. Must be fixed before merge. |
| **Important** | Real bug / design issue the author should fix, but you'd still merge with a "fix in follow-up" plan. |
| **Low** | Nit, naming, orphaned comment, duplicate helper — worth mentioning but don't block on it. |

Never use "Critical" / "Major" / "Minor" (those are Sonar labels, not GitHub review language). Never say "Nit:" without severity — it's always Low.

## Posting back to the PR

Only after you've shown the review in chat and the user has confirmed they want it on the PR.

### Summary review (most common)

```bash
gh pr review <N> --repo <OWNER/REPO> \
  --comment --body "$(cat tmp/review.md)"
# or:
gh pr review <N> --repo <OWNER/REPO> --approve --body ...
gh pr review <N> --repo <OWNER/REPO> --request-changes --body ...
```

### Inline / line-anchored comments

Build a single batched review via the REST API so the comments land atomically and the reviewer isn't spammed with N notifications:

```bash
gh api --method POST \
  repos/<OWNER>/<REPO>/pulls/<N>/reviews \
  -f event=COMMENT \
  -f body="<summary text>" \
  -f 'comments[][path]=packages/adt-cli/src/lib/ui/routes.ts' \
  -F 'comments[][line]=17' \
  -f 'comments[][body]=Orphaned comment after the S7763 codemod.' \
  -f 'comments[][path]=...' -F ...
```

Keys per comment: `path`, `line` (or `start_line`+`line` for a range), `side` (defaults to RIGHT), `body`. See `gh api repos/:owner/:repo/pulls/:number/reviews --help` for the full schema.

### Fixing cosmetic issues yourself

If the finding is a one-line cosmetic fix and you have write access, it's often cleaner to push a commit on top of the PR branch (or open a follow-up) than to leave an inline comment. Mention the commit SHA in the review body. Do NOT force-push or rewrite history on someone else's branch.

For addressing review comments written by someone else on a PR/MR you own, use `$skill{act}` (`/act`).

### Resolving threads is NOT a one-shot operation

Automated reviewers on this repo (CodeRabbit, Devin Review, Amazon Q, Copilot PR reviewer, Kilo) re-scan on **every push**. That means the thread list is a moving target:

- At T=0 you resolve N threads and see "0 open". Correct at T=0.
- Your next commit may trigger new bot reviews within 1–5 minutes.
- Those new threads are NOT resolved just because earlier ones were.

**Workflow:**

1. After batch-resolving threads, **wait for CI + bot re-reviews** to complete before reporting "all resolved". `gh pr checks <N>` pending-count → 0 is a reasonable signal; `gh api graphql` to count open `reviewThreads` is the definitive one.
2. Never say "all threads resolved" in chat without immediately re-running the count query **after** the most recent push. The user sees threads through GitHub's UI in real time; "resolved" claims get falsified instantly if you trust a stale count.
3. If new bot threads appear after your fix, treat them as another round. Do not promise the previous round was the last.

Use:

```bash
gh api graphql -f query='{
  repository(owner: "<owner>", name: "<repo>") {
    pullRequest(number: <N>) {
      reviewThreads(first: 100) { nodes { isResolved } }
    }
  }
}' --jq '.data.repository.pullRequest.reviewThreads.nodes | group_by(.isResolved) | map({resolved: .[0].isResolved, count: length})'
```

… as the authoritative check before and after each batch.

## Forbidden

- Thanking the author ("nice work!", "great PR!"). Compliments go in **Positive observations** as concrete observations ("X correctly handles the null case"), not kudos.
- Re-raising findings a bot already surfaced.
- Guessing at intent when you can ask in two lines of chat.
- Claiming "all threads resolved" / "0 open" without a fresh `reviewThreads` query taken AFTER the most recent push has settled (bots re-scan every commit).
- Approving a PR you haven't actually read the diff of.
- Review comments without file:line references.
