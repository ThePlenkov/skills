#!/usr/bin/env bash
# Toggle a PR (GitHub) or MR (GitLab) between draft and ready-for-review.
# Uses GraphQL for both providers.
#
# Usage: set-review-state.sh --draft|--ready [PROJECT] [NUMBER]
#   PROJECT is owner/repo for GitHub or group/project for GitLab.
#   NUMBER is the PR/MR number. If omitted, the most recently active open
#   review in the current repo is used.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/review-common.sh
source "$SCRIPT_DIR/review-common.sh"

mode=""
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --draft) mode="draft"; shift ;;
    --ready) mode="ready"; shift ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$mode" ]]; then
  echo "usage: set-review-state.sh --draft|--ready [PROJECT] [NUMBER]" >&2
  exit 2
fi

review_parse_args "$@"
review_detect_provider
review_resolve_target

if [[ "$REVIEW_PROVIDER" == "github" ]]; then
  pr_id="$(review_get_github_pr_id "$REVIEW_OWNER" "$REVIEW_REPO" "$REVIEW_NUMBER")"
  if [[ "$mode" == "draft" ]]; then
    # shellcheck disable=SC2016
    query='mutation($id:ID!){convertPullRequestToDraft(input:{pullRequestId:$id}){pullRequest{id isDraft}}}'
  else
    # shellcheck disable=SC2016
    query='mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{id isDraft}}}'
  fi
  result="$(review_graphql -f query="$query" -f id="$pr_id")"
  if echo "$result" | jq -e '.errors' >/dev/null 2>&1; then
    echo "$result" | jq -c '.errors' >&2
    exit 1
  fi
  is_draft="$(echo "$result" | jq -r '.data.markPullRequestReadyForReview.pullRequest.isDraft // .data.convertPullRequestToDraft.pullRequest.isDraft')"
  echo "provider=github owner=$REVIEW_OWNER repo=$REVIEW_REPO pr=$REVIEW_NUMBER draft=$is_draft"
else
  # shellcheck disable=SC2016
  query='mutation($p:ID!,$i:String!,$d:Boolean!){mergeRequestSetDraft(input:{projectPath:$p,iid:$i,draft:$d}){mergeRequest{draft iid}}}'
  if [[ "$mode" == "draft" ]]; then
    draft_value="true"
  else
    draft_value="false"
  fi
  result="$(review_graphql -f query="$query" -F p="$REVIEW_PROJECT_PATH" -f i="$REVIEW_NUMBER" -F d="$draft_value")"
  if echo "$result" | jq -e '.errors' >/dev/null 2>&1; then
    echo "$result" | jq -c '.errors' >&2
    exit 1
  fi
  is_draft="$(echo "$result" | jq -r '.data.mergeRequestSetDraft.mergeRequest.draft')"
  echo "provider=gitlab project=$REVIEW_PROJECT_PATH mr=$REVIEW_NUMBER draft=$is_draft"
fi
