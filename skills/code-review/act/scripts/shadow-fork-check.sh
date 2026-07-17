#!/usr/bin/env bash
# Shadow-fork guard for /act.
#
# If the current repository is a fork and the PR base branch is the default
# branch, ensure fork/<branch> is synced to upstream/<branch>. This stops /act
# from accidentally pulling unrelated upstream commits into a PR when resolving
# merge conflicts.
#
# Usage:
#   shadow-fork-check.sh [OWNER REPO PR_NUMBER]
#
# Exit codes:
#   0  - not a fork, base branch is not the default, or sync is clean
#   1  - usage/environment error
#   20 - fork default branch is ahead of upstream (not a shadow fork)
#   21 - fork default branch has diverged from upstream

set -euo pipefail

usage() {
  cat <<'USAGE'
shadow-fork-check.sh - verify fork default branch is synced to upstream before /act

Usage:
  shadow-fork-check.sh [OWNER REPO PR_NUMBER]

Exit codes:
  0  - not a fork, base branch is not the default, or sync is clean
  1  - usage/environment error
  20 - fork default branch is ahead of upstream (not a shadow fork)
  21 - fork default branch has diverged from upstream
USAGE
}

log() { printf '%s\n' "$*" >&2; }
die() { log "error: $*"; exit 1; }

owner=""
repo=""
pr=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -z "$owner" ]; then
        owner="$1"
      elif [ -z "$repo" ]; then
        repo="$1"
      elif [ -z "$pr" ]; then
        pr="$1"
      else
        die "too many arguments"
      fi
      shift
      ;;
  esac
done

for bin in gh jq git; do
  command -v "$bin" >/dev/null 2>&1 || die "required command not found: $bin"
done
gh auth status >/dev/null 2>&1 || die "gh is not authenticated"

script_dir="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"

# Resolve PR context if not provided.
if [ -z "$owner" ] || [ -z "$repo" ] || [ -z "$pr" ]; then
  read -r owner repo pr < <("$script_dir/pr-from-context.sh") || die "cannot resolve PR context"
fi

repo_json="$(gh repo view "$owner/$repo" --json 'isFork,parent,defaultBranchRef' 2>&1)" || die "cannot view repo $owner/$repo"
is_fork="$(jq -r '.isFork // false' <<<"$repo_json")"

if [ "$is_fork" != "true" ]; then
  log "repo $owner/$repo is not a fork; shadow-fork guard skipped"
  exit 0
fi

default_branch="$(jq -r '.defaultBranchRef.name // "main"' <<<"$repo_json")"
parent_name="$(jq -r 'if .parent then "\(.parent.owner.login)/\(.parent.name)" else empty end' <<<"$repo_json")"
[ -n "$parent_name" ] || die "fork $owner/$repo has no parent repo metadata"

pr_json="$(gh pr view "$pr" --repo "$owner/$repo" --json 'baseRefName' 2>&1)" || die "cannot view PR $owner/$repo#$pr"
base_branch="$(jq -r '.baseRefName' <<<"$pr_json")"

if [ "$base_branch" != "$default_branch" ]; then
  log "PR base branch '$base_branch' is not the default '$default_branch'; shadow-fork guard skipped"
  exit 0
fi

upstream_remote="upstream"
origin_remote="origin"

ensure_remote() {
  local name="$1" url="$2"
  if ! git remote get-url "$name" >/dev/null 2>&1; then
    log "adding git remote $name ($url)"
    git remote add "$name" "$url"
  fi
}

ensure_remote "$upstream_remote" "https://github.com/$parent_name.git"
ensure_remote "$origin_remote" "https://github.com/$owner/$repo.git"

# Try to delegate to the shadow-fork skill's sync-main script; fall back inline.
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
find_sync_main() {
  local candidate
  for candidate in \
    "$repo_root/.agents/skills/shadow-fork/scripts/sync-main" \
    "$repo_root/skills/workflow/git/shadow-fork/scripts/sync-main" \
    "$script_dir/../../shadow-fork/scripts/sync-main" \
    "$script_dir/../../../workflow/git/shadow-fork/scripts/sync-main"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

rc=0
sync_main="$(find_sync_main || true)"

if [ -n "$sync_main" ]; then
  log "using $sync_main"
  if "$sync_main" --upstream-remote "$upstream_remote" --fork-remote "$origin_remote" --branch "$base_branch"; then
    exit 0
  else
    rc=$?
  fi
else
  log "sync-main not found; using inline sync check"

  git fetch --prune "$upstream_remote" "$base_branch"
  git fetch --prune "$origin_remote" "$base_branch"

  up_ref="refs/remotes/$upstream_remote/$base_branch"
  fork_ref="refs/remotes/$origin_remote/$base_branch"

  up_sha="$(git rev-parse "$up_ref^{commit}")"
  fork_sha="$(git rev-parse "$fork_ref^{commit}")"

  if [ "$up_sha" = "$fork_sha" ]; then
    log "ok: $origin_remote/$base_branch equals $upstream_remote/$base_branch"
    exit 0
  fi

  if git merge-base --is-ancestor "$fork_sha" "$up_sha"; then
    log "ok: $origin_remote/$base_branch is behind $upstream_remote/$base_branch; fast-forwarding"
    git push "$origin_remote" "$up_ref:refs/heads/$base_branch"
    git fetch --prune "$origin_remote" "$base_branch"
    exit 0
  fi

  if git merge-base --is-ancestor "$up_sha" "$fork_sha"; then
    log "blocked: $origin_remote/$base_branch is ahead of $upstream_remote/$base_branch"
    rc=20
  else
    log "blocked: $origin_remote/$base_branch has diverged from $upstream_remote/$base_branch"
    rc=21
  fi
fi

case "$rc" in
  20)
    log "shadow-fork guard: the fork's default branch '$base_branch' is AHEAD of upstream."
    log "This repo is a fork but is not a shadow fork: $origin_remote/$base_branch contains commits that $upstream_remote/$base_branch does not."
    log "Stop /act and ask the user to clarify the review scope before proceeding."
    exit 20
    ;;
  21)
    log "shadow-fork guard: the fork's default branch '$base_branch' has DIVERGED from upstream."
    log "Repair $origin_remote/$base_branch explicitly before running /act."
    exit 21
    ;;
  *)
    exit "$rc"
    ;;
esac
