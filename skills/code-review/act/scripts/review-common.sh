#!/usr/bin/env bash
# Shared helpers for review-* scripts. Not meant to be run directly.
# shellcheck shell=bash
set -euo pipefail

# Globals populated by the helper functions below.
REVIEW_PROVIDER=""
REVIEW_HOST=""
REVIEW_OWNER=""
REVIEW_REPO=""
REVIEW_PROJECT_PATH=""
REVIEW_NUMBER=""

# Detect review provider from the git remote URL or ACT_PROVIDER env override.
# Valid values: github, gitlab.
review_detect_provider() {
  if [[ -n "${ACT_PROVIDER:-}" ]]; then
    REVIEW_PROVIDER="$ACT_PROVIDER"
    return 0
  fi

  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  if [[ -z "$remote_url" ]]; then
    echo "error: cannot detect review provider (no origin remote)" >&2
    return 1
  fi

  case "$remote_url" in
    *github.com* | *github:*)
      REVIEW_PROVIDER="github" ;;
    *gitlab.com*)
      REVIEW_PROVIDER="gitlab"
      REVIEW_HOST="gitlab.com" ;;
    *)
      # Self-managed GitLab is any HTTPS/SSH remote not matching GitHub.
      if [[ "$remote_url" =~ ^https?://([^/:]+)/ ]]; then
        REVIEW_HOST="${BASH_REMATCH[1]}"
        REVIEW_HOST="${REVIEW_HOST##*@}"
        REVIEW_PROVIDER="gitlab"
      elif [[ "$remote_url" =~ ^git@([^:]+): ]]; then
        REVIEW_HOST="${BASH_REMATCH[1]}"
        REVIEW_PROVIDER="gitlab"
      else
        echo "error: cannot detect review provider from remote" >&2
        return 1
      fi
      ;;
  esac
}

# Resolve GitLab host override from env or remote. Sets REVIEW_HOST.
review_gitlab_host() {
  if [[ -n "${GITLAB_HOST:-}" ]]; then
    REVIEW_HOST="$GITLAB_HOST"
    return 0
  fi
  if [[ -n "${GL_HOST:-}" ]]; then
    REVIEW_HOST="$GL_HOST"
    return 0
  fi
  if [[ -z "${REVIEW_HOST:-}" ]]; then
    REVIEW_HOST="gitlab.com"
  fi
}

# Parse positional arguments into project path and number.
# Accepts: [NUMBER] | [PROJECT] [NUMBER] | [PROJECT/NUMBER]
# For GitHub PROJECT is owner/repo; for GitLab it is group/project.
review_parse_args() {
  local arg1="${1:-}"
  local arg2="${2:-}"

  if [[ -z "$arg1" ]]; then
    return 0
  fi

  if [[ -n "$arg2" ]]; then
    # Two args: first is project, second is number.
    REVIEW_PROJECT_PATH="$arg1"
    REVIEW_NUMBER="$arg2"
    return 0
  fi

  if [[ "$arg1" =~ ^[0-9]+$ ]]; then
    REVIEW_NUMBER="$arg1"
  else
    # Treat as project path or owner/repo and try to find a number in context later.
    REVIEW_PROJECT_PATH="$arg1"
  fi
}

# Resolve GitHub owner/repo from the project path or git remote.
review_resolve_github_owner_repo() {
  if [[ -n "${REVIEW_PROJECT_PATH:-}" ]]; then
    IFS='/' read -r REVIEW_OWNER REVIEW_REPO <<<"$REVIEW_PROJECT_PATH"
    return 0
  fi

  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    local repo_json
    repo_json="$(gh repo view --json owner,name 2>/dev/null || true)"
    if [[ -n "$repo_json" && "$repo_json" != "null" ]]; then
      REVIEW_OWNER="$(jq -r '.owner.login' <<<"$repo_json")"
      REVIEW_REPO="$(jq -r '.name' <<<"$repo_json")"
    fi
  fi

  if [[ -z "${REVIEW_OWNER:-}" || -z "${REVIEW_REPO:-}" ]]; then
    local remote_url
    remote_url="$(git remote get-url origin 2>/dev/null || true)"
    # git@github.com:owner/repo.git or https://github.com/owner/repo.git
    if [[ "$remote_url" =~ github\.com[:/]([^/]+)/([^/]+) ]]; then
      REVIEW_OWNER="${BASH_REMATCH[1]}"
      REVIEW_REPO="${BASH_REMATCH[2]%.git}"
    fi
  fi
}

# Resolve GitLab project path from the argument or git remote.
review_resolve_gitlab_project_path() {
  if [[ -n "${REVIEW_PROJECT_PATH:-}" ]]; then
    return 0
  fi

  local remote_url
  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  # https://gitlab.example.com/group/project.git or git@gitlab.example.com:group/project.git
  if [[ "$remote_url" =~ ^https?://[^/]+/(.+)$ ]]; then
    REVIEW_PROJECT_PATH="${BASH_REMATCH[1]%.git}"
  elif [[ "$remote_url" =~ ^git@[^:]+:(.+)$ ]]; then
    REVIEW_PROJECT_PATH="${BASH_REMATCH[1]%.git}"
  fi
}

# Resolve a missing PR/MR number from the current branch.
review_resolve_number() {
  if [[ -n "${REVIEW_NUMBER:-}" ]]; then
    return 0
  fi

  if [[ "$REVIEW_PROVIDER" == "github" ]]; then
    if command -v gh >/dev/null 2>&1; then
      local branch pr_json
      branch="$(git branch --show-current 2>/dev/null || true)"
      pr_json="$(gh pr list --head "$branch" --state open --json number --jq '.[0] // empty' 2>/dev/null || true)"
      if [[ -z "$pr_json" || "$pr_json" == "null" ]]; then
        pr_json="$(gh pr list --state open --json number --jq '.[0] // empty' 2>/dev/null || true)"
      fi
      if [[ -n "$pr_json" && "$pr_json" != "null" ]]; then
        REVIEW_NUMBER="$(jq -r '.number' <<<"$pr_json")"
      fi
    fi
    return 0
  fi

  review_resolve_gitlab_number
}

# Best-effort GitLab MR number resolution from the current branch via REST API.
review_resolve_gitlab_number() {
  if [[ -z "${REVIEW_PROJECT_PATH:-}" ]]; then
    echo "error: cannot auto-detect GitLab MR number without project path" >&2
    return 1
  fi

  if [[ -z "${GITLAB_TOKEN:-}" && -z "${GLAB_TOKEN:-}" ]]; then
    echo "error: GitLab MR number omitted and no token to auto-detect (set GITLAB_TOKEN or GLAB_TOKEN, or pass NUMBER)" >&2
    return 1
  fi

  local branch
  branch="$(git branch --show-current 2>/dev/null || true)"
  if [[ -z "$branch" ]]; then
    echo "error: cannot auto-detect GitLab MR number: not on a git branch" >&2
    return 1
  fi

  review_gitlab_host

  local token encoded_path encoded_branch result
  token="${GITLAB_TOKEN:-${GLAB_TOKEN:-}}"
  encoded_path="${REVIEW_PROJECT_PATH//\//%2F}"
  encoded_branch="$(jq -rn --arg b "$branch" '$b|@uri')"
  result="$(curl -fsSL \
    -H "PRIVATE-TOKEN: $token" \
    "https://${REVIEW_HOST}/api/v4/projects/${encoded_path}/merge_requests?source_branch=${encoded_branch}&state=opened&per_page=1" 2>/dev/null || true)"

  if [[ -n "$result" && "$result" != "null" ]]; then
    REVIEW_NUMBER="$(jq -r '.[0].iid // empty' <<<"$result")"
  fi

  if [[ -z "${REVIEW_NUMBER:-}" ]]; then
    echo "error: could not find open GitLab MR for branch '$branch' in $REVIEW_PROJECT_PATH; pass the MR number" >&2
    return 1
  fi
}

# Resolve the project path / owner+repo and MR/PR number.
review_resolve_target() {
  review_detect_provider

  if [[ "$REVIEW_PROVIDER" == "github" ]]; then
    review_resolve_github_owner_repo
  else
    review_resolve_gitlab_project_path
  fi

  if [[ "$REVIEW_PROVIDER" == "github" && ( -z "${REVIEW_OWNER:-}" || -z "${REVIEW_REPO:-}" ) ]]; then
    echo "error: could not resolve GitHub owner/repo" >&2
    return 1
  fi
  if [[ "$REVIEW_PROVIDER" == "gitlab" && -z "${REVIEW_PROJECT_PATH:-}" ]]; then
    echo "error: could not resolve GitLab project path" >&2
    return 1
  fi

  review_resolve_number

  if [[ -z "${REVIEW_NUMBER:-}" ]]; then
    echo "error: could not resolve PR/MR number" >&2
    return 1
  fi
}

# Run a GitHub GraphQL query/mutation using gh.
review_github_graphql() {
  gh api graphql "$@"
}

# Run a GitLab GraphQL query/mutation via curl.
# Args: -f key=value or -F key=value. -F forces JSON scalar encoding
#       (numbers, booleans, and null are passed as JSON values).
# Output: GraphQL response JSON on stdout.
review_gitlab_graphql() {
  review_gitlab_host
  if [[ -z "${GITLAB_TOKEN:-}" && -z "${GLAB_TOKEN:-}" ]]; then
    echo "error: GitLab token not found (set GITLAB_TOKEN or GLAB_TOKEN)" >&2
    return 1
  fi
  local endpoint="https://${REVIEW_HOST}/api/graphql"

  local query=""
  local vars_json="{}"
  local arg key val
  while [[ $# -gt 0 ]]; do
    arg="$1"
    case "$arg" in
      -f|-F)
        key="$2"
        if [[ "$key" == *=* ]]; then
          val="${key#*=}"
          key="${key%%=*}"
        else
          val="$3"
          shift
        fi
        # Strip optional $ prefix from variable name.
        key="${key#\$}"
        if [[ "$key" == "query" ]]; then
          query="$val"
          shift 2
          continue
        fi
        if [[ "$arg" == "-F" && ( "$val" =~ ^(true|false|null)$ || "$val" =~ ^[0-9]+$ ) ]]; then
          vars_json="$(jq --arg k "$key" --argjson v "$val" '.[$k] = $v' <<<"$vars_json")"
        else
          vars_json="$(jq --arg k "$key" --arg v "$val" '.[$k] = $v' <<<"$vars_json")"
        fi
        shift 2 ;;
      *)
        echo "error: unknown argument to review_gitlab_graphql: $arg" >&2
        return 2 ;;
    esac
  done

  if [[ -z "$query" ]]; then
    echo "error: no GraphQL query provided" >&2
    return 2
  fi

  local payload
  payload="$(jq -n --arg q "$query" --argjson v "$vars_json" '{query: $q, variables: $v}')"
  curl -fsSL \
    -H "Content-Type: application/json" \
    -H "PRIVATE-TOKEN: ${GITLAB_TOKEN:-${GLAB_TOKEN:-}}" \
    -X POST \
    -d "$payload" \
    "$endpoint"
}

# Run a GraphQL call against the detected provider.
# Arguments are the same -f/-F key=value pairs as gh api graphql.
review_graphql() {
  if [[ "$REVIEW_PROVIDER" == "github" ]]; then
    review_github_graphql "$@"
  else
    review_gitlab_graphql "$@"
  fi
}

# Resolve GitHub pullRequest node ID from owner/repo/number.
review_get_github_pr_id() {
  local owner="$1" repo="$2" number="$3"
  local query result
  # shellcheck disable=SC2016
  query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){id}}}'
  result="$(review_github_graphql -f query="$query" -f o="$owner" -f r="$repo" -F n="$number")"
  if echo "$result" | jq -e '.errors' >/dev/null 2>&1; then
    echo "$result" | jq -c '.errors' >&2
    return 1
  fi
  echo "$result" | jq -r '.data.repository.pullRequest.id'
}

# Resolve GitLab merge request node ID from project path and iid.
review_get_gitlab_mr_id() {
  local project_path="$1" iid="$2"
  local query result
  query='query($p:ID!,$i:String!){project(fullPath:$p){mergeRequest(iid:$i){id}}}'
  result="$(review_gitlab_graphql -f query="$query" -F p="$project_path" -f i="$iid")"
  if echo "$result" | jq -e '.errors' >/dev/null 2>&1; then
    echo "$result" | jq -c '.errors' >&2
    return 1
  fi
  echo "$result" | jq -r '.data.project.mergeRequest.id'
}
