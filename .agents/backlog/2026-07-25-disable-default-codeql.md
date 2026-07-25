---
date: 2026-07-25
tags: [codeql, ci, billing]
source: https://github.com/theplenkov-ai/skills/pull/157
---

# Disable default CodeQL setup or resolve runner billing

## Problem

PR #157 (drill prevention plans) has a passing custom `CodeQL Advanced` workflow that runs on a self-hosted runner. However, GitHub's default CodeQL setup is still active and creates separate `Analyze (python)` and `Analyze (javascript-typescript)` check runs that fail because they try to use `ubuntu-latest` and the account has a GitHub-hosted runner billing/spending-limit error.

## Evidence

- `git_pr_checks` for PR #157 reports 17 passed / 0 failed / 0 pending.
- `gh api repos/theplenkov-ai/skills/commits/<HEAD>/check-runs` shows `CodeQL Advanced / Analyze (...)` (success, custom workflow) and `Analyze (...)` (failure, default CodeQL).
- Failing run `30162131621` is triggered `via dynamic` and the only annotation is: "The job was not started because recent account payments have failed or your spending limit needs to be increased."

## Options

1. Resolve the GitHub-hosted runner billing/spending limit, then update the custom `.github/workflows/codeql.yml` to grant `security-events: write`, upload SARIF results (`upload: always`) to Code Scanning, and disable the default CodeQL setup (Code security and analysis -> Code scanning) so only the custom workflow runs.
2. If Code Scanning/Advanced Security cannot be enabled, resolve the billing/spending limit so the default CodeQL jobs can provision a runner.
3. Make the repository public or upgrade to a plan where code scanning works without billing issues.

## Owner

Repository admin / billing owner.

## Sinks

- backlog (this file)
- knowledgebase note: `codeql-default-vs-custom-workflow`
