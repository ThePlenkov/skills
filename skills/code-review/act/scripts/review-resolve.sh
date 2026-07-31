#!/usr/bin/env bash
# Batch resolve review threads (GitHub PRs) or discussions (GitLab MRs).
#
# Uses GraphQL for both providers.
#
# Usage: review-resolve.sh [--file PATH] [PROJECT] [NUMBER]
#   PROJECT is owner/repo for GitHub or group/project for GitLab.
#   NUMBER is the PR/MR number (not used when --file is provided, but kept for symmetry).
#   PATH is a plain text file with one thread/discussion global ID per line.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/review-common.sh
source "$SCRIPT_DIR/review-common.sh"

FILE=""
positional=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --) shift; positional+=("$@"); break ;;
    --*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) positional+=("$1"); shift ;;
  esac
done

review_parse_args "${positional[@]}"
review_detect_provider
review_resolve_target

if [[ -z "$FILE" ]]; then
  echo "usage: review-resolve.sh [--file PATH] [PROJECT] [NUMBER]" >&2
  exit 2
fi
if [[ ! -r "$FILE" ]]; then
  echo "error: cannot read $FILE" >&2
  exit 1
fi

ids=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" ]] && continue
  ids+=("$line")
done < "$FILE"

if [[ "${#ids[@]}" -eq 0 ]]; then
  echo "no ids in $FILE"; exit 0
fi

resolved=0
for id in "${ids[@]}"; do
  if [[ "$REVIEW_PROVIDER" == "github" ]]; then
    # shellcheck disable=SC2016
    query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}'
    result="$(review_github_graphql -f query="$query" -f id="$id")"
  else
    # shellcheck disable=SC2016
    query='mutation($id:DiscussionID!){discussionToggleResolve(input:{id:$id,resolve:true}){discussion{resolved}}}'
    result="$(review_gitlab_graphql -f query="$query" -f id="$id")"
  fi
  if echo "$result" | jq -e '.errors' >/dev/null 2>&1; then
    echo "$result" | jq -c '.errors' >&2; exit 1
  fi
  resolved=$((resolved + 1))
  echo "resolved $id"
done

echo "resolved_total=$resolved"
