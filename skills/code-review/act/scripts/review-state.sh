#!/usr/bin/env bash
# Unified PR/MR state dump for /act. Works with GitHub and GitLab using
# GraphQL queries. Replaces ad-hoc provider-specific state collection.
#
# Usage: review-state.sh [PROJECT] [NUMBER]
#   PROJECT is owner/repo for GitHub or group/project for GitLab.
#   NUMBER is the PR/MR number. If omitted, the most recently active open
#   review in the current repo is used.
#
# Output: key=value lines followed by an OPEN_THREADS_TABLE TSV.
#   GitHub: HEAD_SHA, HEAD_REF, URL, MERGEABLE, MERGE_STATE, OPEN_THREADS,
#           CI_REQUIRED_PENDING, SAST_FINDINGS_PENDING, SAST_FINDINGS_UNKNOWN, DRAFT
#   GitLab: HEAD_SHA, HEAD_REF, URL, DRAFT, OPEN_THREADS,
#           CI_REQUIRED_PENDING, SAST_FINDINGS_PENDING, SAST_FINDINGS_UNKNOWN,
#           PIPELINE_STATUS
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/review-common.sh
source "$SCRIPT_DIR/review-common.sh"

review_parse_args "$@"
review_detect_provider
review_resolve_target

if [[ "$REVIEW_PROVIDER" == "github" ]]; then
  # Delegate to the existing GitHub-specific helper for full CI/SAST state,
  # then append the draft flag in the same key=value format.
  "$SCRIPT_DIR/pr-state.sh" "$REVIEW_OWNER" "$REVIEW_REPO" "$REVIEW_NUMBER"

  # shellcheck disable=SC2016
  draft_query='query($o:String!,$r:String!,$pr:Int!){repository(owner:$o,name:$r){pullRequest(number:$pr){isDraft}}}'
  draft_result="$(gh api graphql -f query="$draft_query" -f o="$REVIEW_OWNER" -f r="$REVIEW_REPO" -F pr="$REVIEW_NUMBER")"
  if echo "$draft_result" | jq -e '.errors' >/dev/null 2>&1; then
    echo "$draft_result" | jq -c '.errors' >&2
    exit 1
  fi
  is_draft="$(echo "$draft_result" | jq -r '.data.repository.pullRequest.isDraft')"
  echo "DRAFT=$is_draft"
  exit 0
fi

# GitLab path: project(fullPath) -> mergeRequest(iid).
# pageInfo pagination uses $after with a null default for the first page.
# shellcheck disable=SC2016
mr_query='query($p:ID!,$i:String!,$first:Int!,$after:String=null){
  project(fullPath:$p){
    mergeRequest(iid:$i){
      id iid title draft state sourceBranch diffHeadSha webUrl
      headPipeline{status}
      discussions(first:$first, after:$after){
        pageInfo{hasNextPage endCursor}
        nodes{
          id resolvable resolved
          notes(first:1){
            nodes{
              id author{username} body
              ... on DiffNote { position { filePath newLine oldLine } }
            }
          }
        }
      }
    }
  }
}'

discussions_all='[]'
cursor=""
prev_cursor=""
has_next=true
head_sha=""
head_ref=""
url=""
draft=""
state=""
pipeline_status=""
while [[ "$has_next" == "true" ]]; do
  args=(-f query="$mr_query" -F p="$REVIEW_PROJECT_PATH" -f i="$REVIEW_NUMBER" -F first=100)
  if [[ -n "$cursor" ]]; then
    args+=(-f after="$cursor")
  fi

  result="$(review_gitlab_graphql "${args[@]}")"
  if echo "$result" | jq -e '.errors' >/dev/null 2>&1; then
    echo "$result" | jq -c '.errors' >&2
    exit 1
  fi

  mr_json="$(jq '.data.project.mergeRequest' <<<"$result")"
  head_sha="$(jq -r '.diffHeadSha // empty' <<<"$mr_json")"
  head_ref="$(jq -r '.sourceBranch // empty' <<<"$mr_json")"
  url="$(jq -r '.webUrl // empty' <<<"$mr_json")"
  draft="$(jq -r '.draft' <<<"$mr_json")"
  state="$(jq -r '.state' <<<"$mr_json")"
  pipeline_status="$(jq -r '.headPipeline.status // empty' <<<"$mr_json")"

  page_nodes="$(jq '.discussions.nodes // []' <<<"$mr_json")"
  discussions_all="$(jq -s '.[0] + .[1]' <(echo "$discussions_all") <(echo "$page_nodes"))"

  has_next="$(jq -r '.discussions.pageInfo.hasNextPage' <<<"$mr_json")"
  cursor="$(jq -r '.discussions.pageInfo.endCursor // empty' <<<"$mr_json")"

  if [[ "$has_next" == "true" ]]; then
    if [[ -z "$cursor" ]]; then
      echo "error: GitLab discussions pagination hasNextPage=true but endCursor is empty" >&2
      exit 1
    fi
    if [[ "$cursor" == "$prev_cursor" ]]; then
      echo "error: GitLab discussions pagination cursor did not advance" >&2
      exit 1
    fi
    prev_cursor="$cursor"
  fi
done

open_count="$(jq '[.[] | select(.resolvable == true and .resolved == false)] | length' <<<"$discussions_all")"

# Pipeline is the closest GitLab equivalent of required CI status for a quick pass/fail signal.
ci_required_pending=0
if [[ -n "$pipeline_status" && "$pipeline_status" != "SUCCESS" && "$pipeline_status" != "SKIPPED" ]]; then
  ci_required_pending=1
fi

# SAST annotations are not surfaced by the GitLab GraphQL state query; the agent
# must inspect failed pipeline jobs or the MR diff notes from security tools.
sast_findings_pending=0
sast_findings_unknown=1

echo "HEAD_SHA=$head_sha"
echo "HEAD_REF=$head_ref"
echo "URL=$url"
echo "DRAFT=$draft"
echo "MR_STATE=$state"
echo "OPEN_THREADS=$open_count"
echo "CI_REQUIRED_PENDING=$ci_required_pending"
echo "SAST_FINDINGS_PENDING=$sast_findings_pending"
echo "SAST_FINDINGS_UNKNOWN=$sast_findings_unknown"
echo "PIPELINE_STATUS=$pipeline_status"
echo
echo "OPEN_THREADS_TABLE:"
jq -r '
  .[]
  | select(.resolvable == true and .resolved == false)
  | (.notes.nodes[0] // {}) as $note
  | ($note.position // null) as $pos
  | "\(.id)\t\($note.author.username // "-")\t\(if $pos then "\($pos.filePath):\($pos.newLine // $pos.oldLine)" else "-" end)\t\($note.body // "" | gsub("[\n\t]"; " ") | .[0:120])"
' <<<"$discussions_all"
