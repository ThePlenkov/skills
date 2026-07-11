#!/usr/bin/env bash
# Mark open PR review threads as resolved in GitHub (GraphQL only).
# Does NOT implement review feedback — run only after code fixes / in-thread replies (/act P4).
# Requires: gh, jq, gh auth. Usage: resolve-open-threads.sh [--dry-run] OWNER REPO PR_NUMBER
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  shift
fi

OWNER="${1:?owner}"
REPO="${2:?repo}"
PR="${3:?pr number}"

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI required" >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "error: gh not authenticated (run: gh auth login)" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq required" >&2
  exit 1
fi

resolve_mutation='mutation($id:ID!) {
  resolveReviewThread(input:{threadId:$id}) {
    thread { isResolved }
  }
}'

# Page through reviewThreads (default 100 per page) to avoid silent truncation
# past 100. Mirrors the pagination loop in pr-state.sh — `gh api graphql
# --paginate` does not work for arbitrary connections, so we loop manually
# using `pageInfo.endCursor`.
#
# Each page passes the cursor as a literal embedded in the query string
# (GraphQL accepts only double-quoted cursors) rather than as a $-prefixed
# variable, which would trigger an "unused variable" error.
threads_json_all='[]'
cursor=""
has_next=true
while [[ "$has_next" == "true" ]]; do
  if [[ -z "$cursor" ]]; then
    # shellcheck disable=SC2016  # GraphQL $-prefixed variables are literal.
    var_decls='$o:String!,$r:String!,$pr:Int!,$n:Int!'
    after_clause=""
  else
    # Escape backslashes and double-quotes in the cursor for embedding in a
    # double-quoted string.
    esc_cursor="${cursor//\\/\\\\}"
    esc_cursor="${esc_cursor//\"/\\\"}"
    # shellcheck disable=SC2016  # GraphQL $-prefixed variables are literal.
    var_decls='$o:String!,$r:String!,$pr:Int!,$n:Int!'
    after_clause=", after: \"$esc_cursor\""
  fi

  page_query=$(cat <<EOF
query($var_decls) {
  repository(owner: \$o, name: \$r) {
    pullRequest(number: \$pr) {
      reviewThreads(first: \$n$after_clause) {
        pageInfo { hasNextPage endCursor }
        nodes { id isResolved isOutdated path }
      }
    }
  }
}
EOF
)

  args=( -f query="$page_query" -f o="$OWNER" -f r="$REPO" -F pr="$PR" -F n=100 )
  state_json="$(gh api graphql "${args[@]}" 2>&1)" || { echo "$state_json" >&2; exit 1; }
  if echo "$state_json" | jq -e '.errors' >/dev/null 2>&1; then
    echo "$state_json" | jq -c '.errors' >&2; exit 1
  fi
  if echo "$state_json" | jq -e '.data.repository.pullRequest == null' >/dev/null 2>&1; then
    echo "error: pull request #$PR not found in $OWNER/$REPO" >&2; exit 1
  fi

  threads_json_all="$(jq -s '.[0] + .[1].data.repository.pullRequest.reviewThreads.nodes' \
    <(echo "$threads_json_all") <(echo "$state_json"))"
  has_next="$(echo "$state_json" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')"
  cursor="$(echo "$state_json" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor // empty')"
done

open_ids=()
while IFS= read -r line; do
  [[ -n "$line" ]] && open_ids+=("$line")
done < <(
  echo "$threads_json_all" | jq -r '
    .[]
    | select(.isResolved == false)
    | .id
  '
)

open_count="${#open_ids[@]}"
echo "open_threads=$open_count"

if [[ "$open_count" -eq 0 ]]; then
  echo "nothing to resolve"
  exit 0
fi

echo "$threads_json_all" | jq -r '
  .[]
  | select(.isResolved == false)
  | "\(.id)\toutdated=\(.isOutdated)\t\(.path // "-")"
'

if [[ "$DRY_RUN" == true ]]; then
  echo "dry-run: would resolve $open_count thread(s)"
  exit 0
fi

resolved=0
for id in "${open_ids[@]}"; do
  result="$(gh api graphql -f query="$resolve_mutation" -f id="$id" 2>&1)" || {
    echo "$result" >&2
    exit 1
  }
  ok="$(echo "$result" | jq -r '.data.resolveReviewThread.thread.isResolved // false')"
  if [[ "$ok" == "true" ]]; then
    resolved=$((resolved + 1))
    echo "resolved $id"
  else
    echo "failed $id: $(echo "$result" | jq -c '.errors // .')" >&2
    exit 1
  fi
done

echo "resolved_total=$resolved open_remaining=$((open_count - resolved))"
