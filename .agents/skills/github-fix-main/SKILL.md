---
name: github-fix-main
description: Use when the user asks to fix the current GitHub repository's default branch end-to-end, including latest failing CI on main, open code-scanning or quality findings, and follow-up PR iteration until the branch is green and review feedback is addressed.
---

# github-fix-main

One-shot cleanup of the current GitHub repository's default branch: green CI + no open security/quality findings + one PR to land it all.

## When to Use

- User says `/github-fix-main`, "fix main", "heal main", "почини main".
- Main is red and/or has open code-scanning / AI findings the user wants cleared.
- Before a release, to make sure main is clean.

## When NOT to Use

- Reviewing someone else's PR → `github-pr-review`.
- Triaging a specific reported issue → `triage-issue`.
- Just writing a commit message → `git-commit` / `commit-message-writer`.
- Fixing a red PR branch (not main) → just work the PR directly.

## Invocation

```
/github-fix-main
```

Runs against the **current repo** (detected via `git remote get-url origin`). No arguments.
If the user asks for a different repo, take it as an override but default to current.

## Autopilot contract

Invoking this skill **is** the user's consent for the full flow:

1. Open a new branch, commit fixes, push, open the PR.
2. Wait for CI to finish, fix red checks, push again; repeat until green.
3. Wait for review comments (bots + human), address or push back, resolve threads; repeat until no unaddressed feedback.
4. Stop only on a terminal state (see §9), and then report back in one message.

This overrides the global "never push without asking" rule **for this invocation only**, and only for the `fix/main-health` branch. The agent does not ask follow-up questions between phases — it decides, acts, and reports at the end. Clarifying questions are allowed **only** when the user's scoping choice is genuinely ambiguous before step 1 (e.g. "Sonar has 800 issues, which subset?").

## Principles

- **CI must be green on the PR — always.** The skill's job is to keep the PR's CI green, not to fix it after the fact. Before every push, reproduce **the full CI matrix locally** (§6). If it's red locally, it does not get pushed. A red check on the PR is a skill bug, not a normal state. §7b exists as a safety net for genuine environment drift (different OS, different runner-only tools), not as the expected path.
- **One PR, atomic commits.** Never mix categories in a single commit. Commit prefixes: `ci:`, `security:`, `quality:`, `review:` (for follow-up commits that address review feedback).
- **Latest run only for CI on main.** Older failing runs on main are usually already superseded. Inspect `gh run list --branch <default> --limit 1` and only act if it's red. CI on the PR branch is governed by the rule above.
- **Root cause, not suppression.** Do not `// codeql[ignore]`, `# noqa`, `nosonar`, or add global exclusions to make findings disappear. Fix the code. API-dismiss is allowed only for true false positives with a written justification **recorded in the PR body**; autopilot does not dismiss silently.
- **Nothing-to-do is a valid outcome.** If CI is green, there are no open alerts, and no in-scope Sonar issues, exit with a short "main is already clean" message. Do not open an empty PR.

## Workflow

### 1. Detect repo + default branch

```bash
gh repo view --json nameWithOwner,defaultBranchRef -q '.nameWithOwner + " " + .defaultBranchRef.name'
```

Store as `REPO` and `MAIN`. If `gh` is not authenticated, stop and ask the user to run `gh auth login`.

Create a working branch off the latest `origin/$MAIN`:

```bash
git fetch origin "$MAIN"
git switch -c fix/main-health origin/"$MAIN"
```

### 2. Gather signal in parallel (read-only, safe)

Batch all of these — none write anything:

```bash
# Latest CI run on main
gh run list --branch "$MAIN" --limit 1 \
  --json databaseId,status,conclusion,workflowName,headSha,url

# Open Code Scanning alerts (CodeQL, third-party scanners, AI)
gh api "repos/$REPO/code-scanning/alerts?state=open&per_page=100" \
  --paginate > /tmp/fix-main/code-scanning.json

# Detect if SonarCloud / SonarQube is wired up (presence of config)
ls sonar-project.properties .sonarcloud.properties 2>/dev/null
grep -RIl "SONAR_TOKEN\|sonarcloud\|sonarqube" .github/ 2>/dev/null
```

Make a `tmp/fix-main/` directory and dump all raw responses there. Do not trust a summary until you've seen the JSON.

### 3. Fix CI (latest red run only)

If the latest run's `conclusion` is not `failure`/`cancelled`/`timed_out`, skip this step — main CI is fine.

Otherwise:

```bash
RUN_ID=<databaseId from step 2>
gh run view "$RUN_ID" --log-failed > tmp/fix-main/ci.log
```

- Identify the failing job(s) and the first real error past the noise.
- Reproduce locally if possible (run the same command the workflow ran). Do not fix blind.
- Apply the minimal fix. If the failure is a flake, do **not** mask it — say so to the user and ask whether to retry or investigate.
- Commit:

```
ci: <short imperative summary of the fix>

<what was failing, which job, link to run: ${run url}>
```

- Verify locally (run the relevant script from the workflow, or `bunx nx affected -t build test lint` for this monorepo).

### 4. Fix Code Scanning alerts

For each open alert in `tmp/fix-main/code-scanning.json`:

- Read `rule.id`, `rule.description`, `most_recent_instance.location.path:start_line`, `tool.name`.
- Group by tool: GitHub CodeQL, third-party scanners, and any tool whose `tool.name` or `tool.guid` marks it as an AI scanner. All are treated as real findings here; split only matters for the commit classification (see §6).
- Fix root cause in code.
- If a finding is a true false positive, dismiss it via the API with a reason **only after the user agrees**:

```bash
gh api -X PATCH "repos/$REPO/code-scanning/alerts/<number>" \
  -f state=dismissed -f dismissed_reason=false_positive \
  -f dismissed_comment="<why, with reference>"
```

- Commit the fixes once per logical change (not one per alert — group related hunks):

```
security: <what was unsafe, high-level>

Resolves code-scanning alert(s) #<n>[, #<m>] (<rule-id>).
```

### 5. Fix AI / quality findings (GHAS AI + SonarCloud/SonarQube)

Two possible sources; run whichever exist.

**GitHub Advanced Security AI findings** already came through `/code-scanning/alerts` in step 2. They're distinguishable by `tool.name` (e.g. `GitHub Copilot Autofix`, AI-prefixed scanners) — handle them the same way, but classify commits as `quality:` if they're style/maintainability rather than security.

**SonarCloud / SonarQube**, only if step 2 detected configuration:

```bash
# SonarCloud
curl -sS -u "$SONAR_TOKEN:" \
  "https://sonarcloud.io/api/issues/search?componentKeys=<project-key>&resolved=false&ps=500" \
  > tmp/fix-main/sonar.json
```

- Fix real issues; do **not** add `// NOSONAR` / `@SuppressWarnings("all")` to silence them.
- If Sonar credentials are not present in env, stop and ask the user whether to skip Sonar or provide a token. Do not attempt to browser-scrape the Sonar UI.
- Commit:

```
quality: <what improved>

Resolves SonarCloud issue(s) <key>[, <key>].
```

### 6. CI parity (mandatory before every push)

The goal of this step is simple: **the PR's CI will be green on first push.** To guarantee that, reproduce the same checks CI will run, locally, before pushing. `nx affected` alone is not sufficient — it skips jobs that CI actually runs.

1. Enumerate what CI will run for this PR:

   ```bash
   # Workflows that trigger on PRs to the default branch
   ls .github/workflows/
   # Which jobs + step commands each workflow defines
   yq '.jobs | to_entries | .[] | {job: .key, steps: [.value.steps[].run // empty]}' \
     .github/workflows/*.yml
   ```

   Also check for external checks configured as required on the default branch:

   ```bash
   gh api "repos/$REPO/branches/$MAIN/protection/required_status_checks" 2>/dev/null
   ```

   This catches SonarCloud / CodeQL / third-party checks that are not in `.github/workflows/` but are wired via GitHub Apps.

2. Collect every distinct shell command from those workflow jobs that runs project code (build / test / lint / typecheck / format-check / codegen-verify / spec-validate / …). Normalise job-matrix variables against the PR's actual combination. Skip pure infra steps (checkout, setup-node, cache restore, artifact upload).

3. Run that full set **sequentially**, not via `nx affected`. Use `--skip-nx-cache` for the first pass if Nx caching can mask a genuine regression. Example for this monorepo, but derived from the actual workflow — do not hard-code:

   ```bash
   bunx nx format:check
   bunx nx run-many -t typecheck lint build test --skip-nx-cache
   ```

4. If any step is red → fix, re-run that step, then re-run the full set. Do not cherry-pick only the failed step on subsequent passes.

5. For anything CI runs but that genuinely cannot be reproduced locally (e.g. runner-only secrets, platform-specific matrix, GitHub-hosted scanner), record the gap in `tmp/fix-main/ci-parity-gaps.md` with the exact check name. §7b treats only those gap-checks as "legitimate to fail first on CI"; everything else failing on CI is a skill bug.

6. Run `bunx nx format:write` last to normalise whitespace. If this produces changes, amend into the previous commit (`git commit --amend --no-edit`) — never ship a commit whose only effect is trailing-whitespace fixes on top of another commit.

Only then proceed to §7.

### 7. Push + open PR (no prompt)

Write `tmp/fix-main/pr-body.md` (structure below), then push and open:

```bash
git push -u origin fix/main-health
gh pr create --base "$MAIN" --head fix/main-health \
  --title "fix(main): restore health of main (CI + security + quality)" \
  --body-file tmp/fix-main/pr-body.md
```

Capture the returned PR URL as `PR_URL` and its number as `PR`.

`pr-body.md` structure:

```markdown
## Summary

Restores main to green and clears outstanding security/quality findings.

### CI
- Fixed: <workflow> / <job> (run <link>)  — or "main is already green, no CI fix needed"

### Security (code-scanning)
- <rule-id>: <short what> — alert #<n>
- …

### Quality / AI findings
- <source>: <rule-id>/<key> — <short what>
- …

### Dismissals (if any)
- <rule-id>, alert #<n> — dismissed as false positive. Rationale: <why>.

## Test plan
- [x] `bunx nx affected -t build test lint typecheck` locally
- [x] Reproduced and fixed the red run locally
- [ ] CI on this PR is green
- [ ] CodeQL re-scan confirms fixed alerts are resolved
```

### 7b. CI watch (safety net, not the expected path)

CI should be green on first push because §6 mirrors it locally. This step confirms that, and recovers from genuine environment drift only.

```bash
gh pr checks "$PR" --watch --fail-fast=false
```

Classification of any failing check:

1. **Listed in `tmp/fix-main/ci-parity-gaps.md`** (runner-only / secret-gated / platform-specific).
   - Pull logs, diagnose, fix locally as best as possible, commit as `ci: …`, push, loop. This is the *legitimate* reason to iterate here.

2. **Not listed in gaps.md** — §6 was wrong.
   - Stop. Do not patch blindly on CI. Instead: reproduce the failing command locally (now that CI has shown which command fails), add it to §6's command set for future runs, fix, push once. If reproduction still doesn't show the failure locally, that's a real environment gap — add it to `ci-parity-gaps.md` with evidence, then iterate.

3. **Flake heuristic** — same workflow passed on unrelated recent PRs, log has no useful signal. Re-run **once** (`gh run rerun <run-id> --failed`). A second flake counts as a real failure.

Rules:

- **Hard cap**: 3 push cycles in §7b. A higher number means §6 is broken and the skill is papering over it — stop and hand back.
- **Do not force-push.** Always add a new commit.
- **Do not disable or mask checks** to get green (no `continue-on-error: true` slipped in, no workflow edits that weaken gates, no matrix entries removed). Those are suppressions and are forbidden by the same principle that covers `NOSONAR` / `codeql[ignore]`.

### 7c. Review-response loop (no prompt)

Wait for reviewers (bot + human) and address their feedback. Delegate to the `responding-to-pr-reviews` skill when available.

```bash
# Poll review state
gh pr view "$PR" --json reviewDecision,reviews,comments,latestReviews
gh api "repos/$REPO/pulls/$PR/comments?per_page=100" --paginate
```

Rules:

- Expect automated reviewers first: CodeRabbit / Devin Review / SonarCloud / CodeQL on the PR head. Let them finish before touching anything (initial wait: up to 10 min from push, then poll every 2 min).
- For each thread:
  - If the finding is legitimate → fix at root cause, commit as `review: <what>` (or a specific `security:` / `quality:` prefix if the fix is substantive), push, then reply on the thread pointing at the fix commit + resolve the thread.
  - If the finding is a false positive → reply with a factual push-back (cite code, docs, or CodeQL help text); do not resolve unilaterally.
  - Never mix "fixing the bot" and "fixing the human" in one commit.
- **Human approval wait**: after every automated reviewer is satisfied (no open threads from bots, CI green), wait up to 24h of wall-clock time for a human approval. Check every 15 min. Exit on:
  - `reviewDecision == APPROVED` → report success and stop.
  - `reviewDecision == CHANGES_REQUESTED` → address, loop.
  - Timeout (24h) → report "awaiting human review" and stop without further action.
- **Hard cap**: 10 push cycles across §7b + §7c combined.

### 8. Follow-up

At every terminal state (§9), post a single summary message with:

- Final PR URL + `reviewDecision`.
- Final CI conclusion + link to last run.
- Counts: commits pushed, alerts resolved, threads replied / resolved, dismissals recorded.
- Any outstanding items the user still owns (human approval, merge button, follow-up Sonar PR).

Reminders that belong in that message:

- CodeQL / AI alerts on the PR close only after the re-scan on the PR head completes; the alert list on the security tab may lag.
- Dismissed alerts (if any) remain dismissed on the repo even if the PR is closed — they're tracked in the PR body.

### 9. Terminal states

Stop and report when any of these becomes true:

| State | Condition | Report |
|---|---|---|
| **Clean exit** | Nothing to fix after §2 | "main is already clean" + evidence |
| **Merged-ready** | PR green + APPROVED or all bots satisfied + 24h wait elapsed with no human verdict | "ready to merge" / "awaiting human" |
| **CI cap** | 3 push cycles in §7b without going green | "CI keeps failing, §6 CI-parity step is broken, handing back" + last log |
| **Combined cap** | 10 total push cycles across §7b + §7c | "too many iterations, handing back" |
| **Conflict** | PR cannot fast-forward onto `$MAIN` and rebase introduces non-trivial conflicts | Stop, do not force-push, hand back |
| **Explicit stop** | User sends any message during autopilot | Treat as interrupt: stop the current action, report state |

## References

- `github` skill — raw `gh` usage patterns.
- `github-pr-review` skill — for the reviewer side, once the PR is open.
- `verification-before-completion` — gate before claiming success.
- `git-commit` — atomic commit conventions used here.
