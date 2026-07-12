#!/usr/bin/env bash
# Single-call PR state dump for /act: HEAD SHA, mergeability, open threads (table),
# required CI status (excluding AI reviewers like cubic / CodeRabbit), and the
# count of error-level SAST annotations on FAILING SAST check-runs
# (P0-blocking).
#
# Replaces 4-6 separate `gh pr view` / `gh pr checks` invocations per /act run
# plus the manual SAST annotation probe loop. When CI_REQUIRED_PENDING=0 the
# SAST loop is skipped entirely (cost = 0 extra gh calls).
#
# Usage: pr-state.sh OWNER REPO PR_NUMBER
# Output: key=value lines (HEAD_SHA, HEAD_REF, MERGEABLE, MERGE_STATE,
#         OPEN_THREADS, CI_REQUIRED_PENDING, SAST_FINDINGS_PENDING) followed by
#         a 4-column TSV table of open threads:
#           id<TAB>author<TAB>path:line<TAB>body[:120]
#         (newlines and tabs in the body are collapsed to spaces so each row
#         stays on a single line; pagination uses pageInfo.hasNextPage.)
set -euo pipefail

OWNER="${1:?owner}"
REPO="${2:?repo}"
PR="${3:?pr number}"

for bin in gh jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "error: $bin required" >&2; exit 1; }
done
gh auth status >/dev/null 2>&1 || { echo "error: gh not authenticated" >&2; exit 1; }

# Page through reviewThreads (default 100 per page) to avoid silent truncation.
# `gh api graphql --paginate` does not work for arbitrary connections, so loop
# manually using `pageInfo.endCursor`.
#
# The GraphQL query needs an `after: $after` clause on every call after the
# first. We build it as one literal string with the cursor spliced in
# (escaping any quotes in the cursor).
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
    # double-quoted string (GraphQL accepts only double-quoted cursors).
    # The cursor is spliced into the query as a literal; we do NOT also pass
    # it as a $-prefixed variable (would trigger an "unused variable" error).
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
      headRefOid
      headRefName
      mergeable
      state
      url
      reviewThreads(first: \$n$after_clause) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved isOutdated
          comments(first: 1) { nodes { author { login } path line body } }
        }
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

read -r head_sha head_ref mergeable url <<<"$(jq -r '
  [
    .data.repository.pullRequest.headRefOid,
    .data.repository.pullRequest.headRefName,
    (.data.repository.pullRequest.mergeable // "UNKNOWN" | ascii_downcase),
    .data.repository.pullRequest.url
  ] | @tsv
' <<<"$state_json")"

# GitHub may report mergeable=MERGEABLE (REST) or mergeable=mergeable (GraphQL). Normalize.
case "$mergeable" in
  mergeable|MERGEABLE) mergeable="MERGEABLE" ;;
  conflicting|CONFLICTING) mergeable="CONFLICTING" ;;
  *) mergeable="${mergeable^^}" ;;
esac

# mergeStateStatus comes from the REST Checks API (not in the GraphQL PR object).
rest_json="$(gh pr view "$PR" --repo "$OWNER/$REPO" --json mergeStateStatus 2>&1)" || {
  echo "$rest_json" >&2; exit 1;
}
merge_state="$(echo "$rest_json" | jq -r '.mergeStateStatus // "UNKNOWN"')"

# gh pr checks exits 1 with "no checks reported" when no checks have run yet.
checks_json="$(gh pr checks "$PR" --repo "$OWNER/$REPO" --json name,state,bucket 2>&1)" || {
  if echo "$checks_json" | grep -qi "no checks reported"; then
    checks_json="[]"
  else
    echo "$checks_json" >&2; exit 1
  fi
}

open_count="$(jq '[.[] | select(.isResolved==false)] | length' <<<"$threads_json_all")"

# Required CI status: any check whose bucket is not 'pass' (i.e. it was NOT a
# success) and whose state is not SKIPPED or NEUTRAL. Excludes AI reviewers by name.
ci_required_pending="$(jq -r '
  [
    .[]
    | select(.bucket != "pass")
    | select(.state != "SKIPPED" and .state != "NEUTRAL")
    | select(.name | test("(?i)(cubic|code\\s*rabbit|amazon\\s*q|qodo|chatgpt\\s*codex|gemini|kilo)"; "x") | not)
  ] | length
' <<<"$checks_json")"

# Recognised SAST tools by case-insensitive substring match on the check name.
# Vendor workflow labels frequently prefix these names (e.g. "Trivy - main",
# "github/codeql-action/analyze"), so we use substring rather than anchored
# matching.
is_sast_tool_name() {
  local lower
  lower="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    *sonarcloud* | *sonarqube* | \
    *codacy* | *codescene* | \
    *codeql* | *semgrep* | *opengrep* | \
    *trivy* | *snyk* | *skillspector* | *gitguardian* | \
    *checkov* | *kics* | *tfsec* | *gitleaks*)
      return 0 ;;
    *)
      return 1 ;;
  esac
}

# Count annotation_level=failure entries on a single check-run, paging through
# all pages (default page is 50 annotations; large SARIF uploads can exceed it).
# Echoes the count; on failure prints the offending run name to stderr and
# exits non-zero so the caller can surface the failure rather than silently
# reporting zero.
count_failure_annotations() {
  local run_id="$1"
  local run_name="$2"
  gh api --paginate "repos/$OWNER/$REPO/check-runs/$run_id/annotations" \
    --jq '[.[] | select(.annotation_level=="failure")] | length' 2>/dev/null \
    || { echo "warn: annotations API failed for run $run_id ($run_name)" >&2; return 1; }
}

# SAST error annotations on FAILING checks. When CI_REQUIRED_PENDING=0 this
# block is skipped entirely; otherwise each failing SAST run contributes its
# count of annotation_level=failure entries (the ::error:: equivalent).
#
# We deliberately scope to failing checks: passing SAST runs do not gate
# /act, and skipped/neutral ones do not produce annotations. Substring
# matching on the check name lets us handle vendor-prefixed names like
# "Trivy - main" or "github/codeql-action/analyze (typescript)".
# Map check-run names to IDs. gh pr checks does not expose the check-run id,
# so fetch the check-runs for HEAD and build a name→id lookup for SAST calls.
declare -A CHECK_RUN_IDS
while IFS=$'\t' read -r id name; do
  CHECK_RUN_IDS["$name"]="$id"
done < <(gh api --paginate "repos/$OWNER/$REPO/commits/$head_sha/check-runs" \
  --jq '.check_runs | sort_by(.id) | .[] | [(.id|tostring), .name] | @tsv')

sast_findings_pending=0
sast_findings_unknown=0
if [[ "$ci_required_pending" -gt 0 ]]; then
  while IFS=$'\t' read -r r_name r_bucket r_state; do
    [[ "$r_bucket" == "pass" ]] && continue
    [[ "$r_state" == "SKIPPED" || "$r_state" == "NEUTRAL" ]] && continue
    is_sast_tool_name "$r_name" || continue
    id="${CHECK_RUN_IDS[$r_name]:-}"
    [[ -z "$id" || "$id" == "null" ]] && continue
    if errs=$(count_failure_annotations "$id" "$r_name"); then
      sast_findings_pending=$(( sast_findings_pending + errs ))
    else
      sast_findings_unknown=$(( sast_findings_unknown + 1 ))
    fi
  done < <(gh pr checks "$PR" --repo "$OWNER/$REPO" \
      --json name,bucket,state \
      --jq '.[] | [.name, .bucket, .state] | @tsv')
fi

echo "HEAD_SHA=$head_sha"
echo "HEAD_REF=$head_ref"
echo "URL=$url"
echo "MERGEABLE=$mergeable"
echo "MERGE_STATE=$merge_state"
echo "OPEN_THREADS=$open_count"
echo "CI_REQUIRED_PENDING=$ci_required_pending"
echo "SAST_FINDINGS_PENDING=$sast_findings_pending"
echo "SAST_FINDINGS_UNKNOWN=$sast_findings_unknown"
echo
echo "OPEN_THREADS_TABLE:"
jq -r '
  .[]
  | select(.isResolved == false)
  | . as $t
  | ($t.comments.nodes[0] // {}) as $c
  | "\($t.id)\t\($c.author.login // "-")\t\([$c.path // "-", ($c.line // "-" | tostring)] | join(":"))\t\($c.body // "" | gsub("[\n\t]"; " ") | .[0:120])"
' <<<"$threads_json_all"
