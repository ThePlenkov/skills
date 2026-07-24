---
name: github-fix-main
description: Use when the user asks to fix the current GitHub repository's default branch end-to-end, including latest failing CI on main, open code-scanning or quality findings, and follow-up PR iteration until the branch is green and review feedback is addressed.
tier: 2
triggers: [user, model]
source: theplenkov-ai/skills
---

# github-fix-main

One-shot cleanup of the default branch: green CI + no open security/quality findings + one PR to land it all.

## When to use

- `/github-fix-main`, "fix main", "heal main", "почини main".
- Main is red and/or has open code-scanning / AI findings to clear.
- Before a release.

## When NOT to use

- Reviewing someone else's PR → `$skill{github-pr-review}`.
- Triaging a reported issue → `$skill{triage-issue}`.
- Writing a commit message only → `$skill{git-commit}`.
- Fixing a red PR branch (not main) → work the PR directly.

## Invocation

```
/github-fix-main
```

Runs against the **current repo** (`git remote get-url origin`). Override accepted but default to current.

## Autopilot contract

Invoking this skill **is** consent for the full flow:

1. New branch, commits, push, PR open.
2. Wait for CI; fix red checks; push; repeat until green.
3. Wait for review comments (bots + human); address or push back; resolve threads; repeat.
4. Stop only on a terminal state ([references/terminal-states.md](references/terminal-states.md)) and report in one message.

Overridden "never push without asking" only for this invocation, only for the `fix/main-health` branch. Agent proceeds with mid-phase decisions and reports at the end. Clarifying questions only when scoping is genuinely ambiguous before step 1.

## Principles

- **CI must be green on the PR — always.** Reproduce the full CI matrix locally before every push (§6). Red local → no push. §7b is safety net for genuine environment drift, not the expected path.
- **One PR, atomic commits.** Never mix categories. Prefixes: `ci:`, `security:`, `quality:`, `review:`.
- **Latest run only for CI on main.** Older runs are usually superseded.
- **Root cause, not suppression.** No `// codeql[ignore]`, `# noqa`, `nosonar`, or global exclusions to silence findings. Fix the code. API-dismiss only for true false positives with written justification **recorded in the PR body**.
- **Nothing-to-do is a valid outcome.** If main is green + no alerts + no in-scope Sonar — short "main is already clean" and exit. Never an empty PR.

## Workflow

### 1. Detect repo + default branch

```bash
gh repo view --json nameWithOwner,defaultBranchRef -q '.nameWithOwner + " " + .defaultBranchRef.name'
```

Store as `REPO` and `MAIN`. If unauthenticated, stop and ask the user to `gh auth login`. Working branch:

```bash
git fetch origin "$MAIN"
git switch -c fix/main-health origin/"$MAIN"
```

### 2. Gather signal in parallel

```bash
gh run list --branch "$MAIN" --limit 1 --json databaseId,status,conclusion,workflowName,headSha,url
gh api "repos/$REPO/code-scanning/alerts?state=open&per_page=100" --paginate > tmp/fix-main/code-scanning.json
ls sonar-project.properties .sonarcloud.properties 2>/dev/null
grep -RIl "SONAR_TOKEN\|sonarcloud\|sonarqube" .github/ 2>/dev/null
```

Dump all raw responses under `tmp/fix-main/`. Verify Sonar credentials before assuming SonarCloud fix is in-scope.

### 3. Fix CI

Skip if `conclusion` not in {`failure`,`cancelled`,`timed_out`}. Otherwise: `gh run view "$RUN_ID" --log-failed > tmp/fix-main/ci.log`. Identify failing jobs + first real error. Reproduce locally. Minimal fix. If flake, do NOT mask — ask.

Commit:

```
ci: <short imperative summary of the fix>

<what was failing, which job, link to run: ${run url}>
```

Verify locally (workflow script or `bunx nx affected -t build test lint`).

### 4. Fix code-scanning alerts

Group by tool (CodeQL, third-party, AI-marked). Fix root cause in code. True false positive → dismiss via API only after user agrees:

```bash
gh api -X PATCH "repos/$REPO/code-scanning/alerts/<number>" \
  -f state=dismissed -f dismissed_reason=false_positive \
  -f dismissed_comment="<why, with reference>"
```

Commit per logical change (group related hunks):

```
security: <what was unsafe, high-level>

Resolves code-scanning alert(s) #<n>[, #<m>] (<rule-id>).
```

### 5. Fix AI / quality findings

**GHAS AI findings** came through step 2. Handle the same as code-scanning; commit as `quality:` for style/maintainability.

**SonarCloud / SonarQube** (if step 2 detected config):

```bash
curl -sS -u "$SONAR_TOKEN:" \
  "https://sonarcloud.io/api/issues/search?componentKeys=<project-key>&resolved=false&ps=500" \
  > tmp/fix-main/sonar.json
```

Fix real issues. No `// NOSONAR` / `@SuppressWarnings("all")`. Missing creds → ask user (skip Sonar or provide a token). No browser-scraping Sonar UI.

Commit:

```
quality: <what improved>

Resolves SonarCloud issue(s) <key>[, <key>].
```

### 6. CI parity (mandatory before every push)

Reproduce the same checks CI will run, locally, before pushing. Full procedure — `nx affected` caveats, workflow command enumeration, gap detection, format normalization — see [references/ci-parity.md](references/ci-parity.md). §6 mirrored locally is what makes the PR green on first push.

### 7. Push + open PR

Write `tmp/fix-main/pr-body.md` per the template in [references/pr-body.md](references/pr-body.md), then:

```bash
git push -u origin fix/main-health
gh pr create --base "$MAIN" --head fix/main-health \
  --title "fix(main): restore health of main (CI + security + quality)" \
  --body-file tmp/fix-main/pr-body.md
```

Capture the returned PR URL as `PR_URL`, number as `PR`.

### 7b. CI watch (safety net)

CI should already be green because §6 mirrored it. Confirm with `gh pr checks "$PR" --watch --fail-fast=false`. Classify failures:

1. **Listed in `tmp/fix-main/ci-parity-gaps.md`** — pull logs, fix locally, `ci: …`, push, loop. Legitimate.
2. **Not listed** — §6 was wrong. Stop. Reproduce the failing command locally, add it to §6's command set, fix, push once.
3. **Flake** (same workflow passed on unrelated PRs, no useful signal) — re-run once (`gh run rerun <run-id> --failed`). Second flake = real failure.

**Hard cap**: 3 push cycles in §7b (higher = §6 broken, hand back). Never force-push. Never disable / mask checks (`continue-on-error`, matrix removal, gate weakening) — those are suppressions and forbidden.

### 7c. Review-response loop

Resolve review feedback inline or delegate to `$skill{github-pr-review}`.

```bash
gh pr view "$PR" --json reviewDecision,reviews,comments,latestReviews
gh api "repos/$REPO/pulls/$PR/comments?per_page=100" --paginate
```

Let automated reviewers (CodeRabbit / Devin Review / SonarCloud / CodeQL) finish first. Initial wait: 10 min from push, then poll every 2 min.

Per thread:

- Legitimate → fix root cause, `review: <what>` (or `security:`/`quality:` for substantive fixes), push, reply pointing at the commit, resolve.
- False positive → factual push-back citing code/docs/CodeQL help; do not resolve unilaterally.
- Never mix "fixing the bot" and "fixing the human" in one commit.

**Human approval wait**: after every automated reviewer is satisfied + CI green, wait up to 24h. Check every 15 min. Exit on `APPROVED` (report, stop), `CHANGES_REQUESTED` (address, loop), or 24h timeout (report "awaiting human review", stop).

**Hard cap**: 10 push cycles across §7b + §7c combined.

## References

- [references/ci-parity.md](references/ci-parity.md) — §6 reproducible CI command set.
- [references/pr-body.md](references/pr-body.md) — PR body template + `gh pr create` invocation.
- [references/terminal-states.md](references/terminal-states.md) — stop conditions and follow-up message template.
- `$skill{github}` — raw `gh` patterns.
- `$skill{github-pr-review}` — reviewer side once the PR is open.
- `$skill{git-commit}` — atomic commit conventions.
