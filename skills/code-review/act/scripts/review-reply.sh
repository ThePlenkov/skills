#!/usr/bin/env bash
# Batch reply to review threads/discussions on GitHub or GitLab, with an
# optional reaction on the newly created reply.
#
# Uses GraphQL for both providers.
#
# Usage: review-reply.sh [--file PATH] [--reaction NAME] [PROJECT] [NUMBER]
#   PROJECT is owner/repo for GitHub or group/project for GitLab.
#   NUMBER is the PR/MR number.
#   PATH is a TSV file with one row per reply: <thread_or_discussion_id>\t<body>
#   NAME is a ReactionContent for GitHub (EYES, THUMBS_UP) or an emoji name
#   for GitLab (eyes, thumbsup).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/review-common.sh
source "$SCRIPT_DIR/review-common.sh"

FILE=""
REACTION=""
positional=()
# Parse flags anywhere in the argument list.
while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --reaction) REACTION="$2"; shift 2 ;;
    --) shift; positional+=("$@"); break ;;
    --*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) positional+=("$1"); shift ;;
  esac
done

review_parse_args "${positional[@]}"
review_detect_provider
review_resolve_target

if [[ -z "$FILE" ]]; then
  echo "usage: review-reply.sh [--file PATH] [--reaction NAME] [PROJECT] [NUMBER]" >&2
  exit 2
fi
if [[ ! -r "$FILE" ]]; then
  echo "error: cannot read $FILE" >&2
  exit 1
fi

# For GitLab replies we need the MR node ID as the noteable.
gitlab_mr_id=""
if [[ "$REVIEW_PROVIDER" == "gitlab" ]]; then
  gitlab_mr_id="$(review_get_gitlab_mr_id "$REVIEW_PROJECT_PATH" "$REVIEW_NUMBER")"
fi

TAB=$'\t'
threads=()
bodies=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" ]] && continue
  if [[ "$line" != *"$TAB"* ]]; then
    echo "warn: skipping line without tab separator" >&2
    continue
  fi
  tid="${line%%"$TAB"*}"
  body="${line#*"$TAB"}"
  [[ -z "$tid" ]] && { echo "warn: empty thread/discussion id" >&2; continue; }
  body="${body//\\n/$'\n'}"
  body="${body//\\t/$TAB}"
  threads+=("$tid")
  bodies+=("$body")
done < "$FILE"

count="${#threads[@]}"
if [[ "$count" -eq 0 ]]; then
  echo "no rows in $FILE"; exit 0
fi

posted=0
failed=()
for ((i=0; i<count; i++)); do
  tid="${threads[i]}"
  body="${bodies[i]}"

  reply_id=""
  if [[ "$REVIEW_PROVIDER" == "github" ]]; then
    # shellcheck disable=SC2016
    reply_query='mutation($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id}}}'
    if ! result="$(review_github_graphql -f query="$reply_query" -f id="$tid" -f body="$body" 2>&1)"; then
      echo "error: failed to reply to $tid" >&2
      echo "$result" >&2
      failed+=("$tid")
      continue
    fi
    if echo "$result" | jq -e '.errors' >/dev/null 2>&1; then
      echo "$result" | jq -c '.errors' >&2
      failed+=("$tid")
      continue
    fi
    reply_id="$(echo "$result" | jq -r '.data.addPullRequestReviewThreadReply.comment.id')"
    if [[ -n "$REACTION" && -n "$reply_id" && "$reply_id" != "null" ]]; then
      # Reaction failures are logged but do not fail the whole batch.
      # shellcheck disable=SC2016
      react_query='mutation($id:ID!,$content:ReactionContent!){addReaction(input:{subjectId:$id,content:$content}){reaction{id}}}'
      review_github_graphql -f query="$react_query" -f id="$reply_id" -f content="$REACTION" >/dev/null 2>&1 || true
    fi
  else
    # GitLab: create a note inside the discussion; noteableId is the MR global ID.
    # shellcheck disable=SC2016
    reply_query='mutation($noteableId:NoteableID!,$discussionId:DiscussionID!,$body:String!){createNote(input:{noteableId:$noteableId,discussionId:$discussionId,body:$body}){note{id}}}'
    if ! result="$(review_gitlab_graphql -f query="$reply_query" -f noteableId="$gitlab_mr_id" -f discussionId="$tid" -f body="$body" 2>&1)"; then
      echo "error: failed to reply to $tid" >&2
      echo "$result" >&2
      failed+=("$tid")
      continue
    fi
    if echo "$result" | jq -e '.errors' >/dev/null 2>&1; then
      echo "$result" | jq -c '.errors' >&2
      failed+=("$tid")
      continue
    fi
    reply_id="$(echo "$result" | jq -r '.data.createNote.note.id')"
    if [[ -n "$REACTION" && -n "$reply_id" && "$reply_id" != "null" ]]; then
      # shellcheck disable=SC2016
      react_query='mutation($awardableId:AwardableID!,$name:String!){awardEmojiAdd(input:{awardableId:$awardableId,name:$name}){awardEmoji{name}}}'
      review_gitlab_graphql -f query="$react_query" -f awardableId="$reply_id" -f name="$REACTION" >/dev/null 2>&1 || true
    fi
  fi
  posted=$((posted + 1))
  echo "replied $tid"
done

if [[ "${#failed[@]}" -gt 0 ]]; then
  echo "posted=$posted requested=$count failed=${#failed[@]}" >&2
  echo "failed_ids=${failed[*]}" >&2
  exit 1
fi

echo "posted=$posted requested=$count"
