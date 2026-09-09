#!/usr/bin/env bash
# Resolve the PR to act on from the current conversation / repo context.
# This is the fallback used when the user says `/act` without a PR number.
#
# Resolution order:
# 1. PR whose head branch matches the current git branch (if not main/master).
# 2. The single/most-recently-updated open PR in the repo.
#
# Output: three space-separated fields on stdout: OWNER REPO PR_NUMBER
#         (e.g. "ThePlenkov skills 30").
# On stderr: a one-line note about which PR was chosen.
set -euo pipefail

for bin in gh jq git; do
  command -v "$bin" >/dev/null 2>&1 || { echo "error: $bin required" >&2; exit 1; }
done
gh auth status >/dev/null 2>&1 || { echo "error: gh not authenticated" >&2; exit 1; }

read -r owner repo <<<"$(gh repo view --json owner,name --jq '[.owner.login, .name] | @tsv')"

# Try to match the current git branch first. A branch named main/master is
# unlikely to be a PR head; skip it to avoid a noisy, wrong match.
branch="$(git branch --show-current 2>/dev/null || true)"
pr_json=""
if [[ -n "$branch" && "$branch" != "main" && "$branch" != "master" ]]; then
  pr_json="$(gh pr list --head "$branch" --state open --json number,title,url,updatedAt --limit 1 --jq '.[0] // empty' 2>/dev/null || true)"
fi

# Fall back to the most recently active open PR in the repo.
if [[ -z "$pr_json" || "$pr_json" == "null" ]]; then
  pr_json="$(gh pr list --state open --json number,title,url,updatedAt --limit 1 --jq '.[0] // empty' 2>/dev/null || true)"
fi

if [[ -z "$pr_json" || "$pr_json" == "null" ]]; then
  echo "error: no open pull request found in $owner/$repo" >&2
  exit 1
fi

pr_number="$(jq -r '.number' <<<"$pr_json")"
pr_title="$(jq -r '.title' <<<"$pr_json")"
pr_url="$(jq -r '.url' <<<"$pr_json")"

# Keep stdout clean for callers that parse it.
echo "Using PR #$pr_number: $pr_title ($pr_url)" >&2
echo "$owner $repo $pr_number"
