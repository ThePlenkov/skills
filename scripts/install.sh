#!/usr/bin/env bash
# Install skills from this repo as flat symlinks into an .agents/skills directory.
#
# Default (project install): creates .agents/skills/<skill-name> symlinks in the repo.
# --home: creates ~/.agents/skills/<skill-name> symlinks (dotfiles / global install).
# --target=DIR: install into the given directory (used by the bin/skills.js wrapper
#               to honour a caller's --project working directory).
# --copy: copy skill files into the target instead of creating symlinks.
#         Use this when running from a transient package-runner cache (npx, bunx,
#         pnpm dlx) where the original location may be garbage-collected and the
#         symlinks would otherwise dangle.
# --check: verify the target directory is in sync and exit 1 if not.
# --dry-run: print what would be done without changing anything.

if [[ "${BASH_VERSINFO[0]}" -lt 4 ]]; then
  printf 'This script requires bash 4.0 or later (found %s).\n' "${BASH_VERSION}" >&2
  exit 1
fi

set -euo pipefail

# Compute a relative path from base ($2) to target ($1) using bash builtins.
# base is expected to be an absolute, canonical path (it need not exist).
# target is canonicalised via cd/pwd -P.
relpath() {
  local target_dir="$1" base_abs="$2"
  local target_abs
  target_abs=$(cd "$target_dir" && pwd -P) || return 1

  if [[ -e "$base_abs" ]]; then
    base_abs=$(cd "$base_abs" && pwd -P) || return 1
  fi

  # Strip trailing slashes to avoid empty path components.
  target_abs="${target_abs%/}"
  base_abs="${base_abs%/}"

  local IFS=/
  local -a target_parts base_parts
  read -r -a target_parts <<< "${target_abs#/}"
  read -r -a base_parts <<< "${base_abs#/}"

  local common=0
  while [[ "$common" -lt "${#base_parts[@]}" ]] &&
        [[ "$common" -lt "${#target_parts[@]}" ]] &&
        [[ "${base_parts[$common]}" = "${target_parts[$common]}" ]]; do
    common=$((common + 1))
  done

  local -a result_parts=()
  local i=$common
  while [[ "$i" -lt "${#base_parts[@]}" ]]; do
    result_parts+=("..")
    i=$((i + 1))
  done
  i=$common
  while [[ "$i" -lt "${#target_parts[@]}" ]]; do
    result_parts+=("${target_parts[$i]}")
    i=$((i + 1))
  done

  if [[ "${#result_parts[@]}" -eq 0 ]]; then
    printf '.\n'
  else
    local result=""
    for part in "${result_parts[@]}"; do
      if [[ -n "$result" ]]; then
        result="${result}/${part}"
      else
        result="$part"
      fi
    done
    printf '%s\n' "$result"
  fi
}

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
SOURCE_DIR="${REPO_ROOT}/skills"

HOME_INSTALL=0
DRY_RUN=0
CHECK=0
FORCE=0
COPY=0
TARGET_DIR_OVERRIDE=

for arg in "$@"; do
  case "$arg" in
    --home)
      HOME_INSTALL=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --check)
      CHECK=1
      ;;
    --force)
      FORCE=1
      ;;
    --copy)
      COPY=1
      ;;
    --target=*)
      TARGET_DIR_OVERRIDE=${arg#--target=}
      if [[ -z "$TARGET_DIR_OVERRIDE" ]]; then
        printf '--target requires a directory path\n' >&2
        exit 1
      fi
      ;;
    --help)
      printf 'Usage: %s [--home|--target=DIR] [--copy] [--dry-run|--check] [--force]\n' "$(basename "$0")"
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$arg" >&2
      exit 1
      ;;
  esac
done

if [[ -n "$TARGET_DIR_OVERRIDE" ]] && [[ "$HOME_INSTALL" = 1 ]]; then
  printf '--target cannot be combined with --home\n' >&2
  exit 1
fi

# Copy mode: the target entries are installer-managed copies, so the
# install must be idempotent (a second run replaces prior copies in-place)
# and --check must compare contents rather than blindly marking them out
# of sync. We achieve both via a per-entry marker file (see MANAGED_MARKER
# below): the marker is the proof that an entry is ours, so a re-run can
# safely refresh it (the upgrade path); foreign content that happens to
# share a name with a skill is left alone. Stale entries not in WANT_DIRS
# remain gated by FORCE as before.
MANAGED_MARKER=".skills-managed-by-install-sh"
write_managed_marker() {
  local dir="$1"
  printf 'skills-managed-by-install-sh\n' > "$dir/$MANAGED_MARKER"
}
# Compare two trees, treating the managed marker as invisible. diff -r
# doesn't have a portable --exclude (GNU-only), so temporarily move the
# marker aside for the comparison and put it back regardless of result.
content_matches() {
  local src="$1" dst="$2" marker_tmp=""
  if [[ -f "$dst/$MANAGED_MARKER" ]]; then
    marker_tmp=$(mktemp)
    mv "$dst/$MANAGED_MARKER" "$marker_tmp"
  fi
  if diff -r "$src" "$dst" >/dev/null 2>&1; then
    [[ -n "$marker_tmp" ]] && mv "$marker_tmp" "$dst/$MANAGED_MARKER"
    return 0
  else
    [[ -n "$marker_tmp" ]] && mv "$marker_tmp" "$dst/$MANAGED_MARKER"
    return 1
  fi
}

# shellcheck source=ensure-reserved.sh
source "$(dirname "$0")/ensure-reserved.sh"

if [[ -n "$TARGET_DIR_OVERRIDE" ]]; then
  TARGET_DIR="$TARGET_DIR_OVERRIDE"
  BASE_ABS="$TARGET_DIR_OVERRIDE"
elif [[ "$HOME_INSTALL" = 1 ]]; then
  TARGET_DIR="${HOME}/.agents/skills"
  BASE_ABS="$(cd "$HOME" && pwd -P)/.agents/skills"
else
  TARGET_DIR="${REPO_ROOT}/.agents/skills"
  BASE_ABS="${REPO_ROOT}/.agents/skills"
  # The repo's .agents/skills is a generated view; we can safely replace stale copies on install.
  if [[ "$CHECK" = 0 ]] && [[ "$DRY_RUN" = 0 ]]; then
    FORCE=1
  fi
fi

# Copy mode: the target entries are installer-managed copies, so the
# per-skill install loop must be idempotent — a second run replaces prior
# copies in-place. The actual recognition is done via the per-entry
# MANAGED_MARKER file (declared below); FORCE continues to gate the
# stale-entry removal loop so `--copy` does not silently delete foreign
# content in the target directory when the user did not opt in.

if [[ "$DRY_RUN" = 1 ]] && [[ "$CHECK" = 1 ]]; then
  printf '%s\n' '--dry-run and --check are mutually exclusive' >&2
  exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  printf 'Source directory not found: %s\n' "$SOURCE_DIR" >&2
  exit 1
fi

DIFF=0

# Remove legacy nested ~/.agents/skills/personal symlink if present.
PERSONAL_LINK="${HOME}/.agents/skills/personal"
if [[ "$HOME_INSTALL" = 1 ]] && [[ -L "$PERSONAL_LINK" ]]; then
  if [[ "$CHECK" = 1 ]] || [[ "$DRY_RUN" = 1 ]]; then
    printf 'Would remove legacy symlink: %s\n' "$PERSONAL_LINK"
    DIFF=1
  else
    printf 'Removing legacy symlink: %s\n' "$PERSONAL_LINK"
    rm "$PERSONAL_LINK"
  fi
fi

# If the target itself is a symlink, replace it with a directory.
if [[ -L "$TARGET_DIR" ]]; then
  if [[ "$CHECK" = 1 ]] || [[ "$DRY_RUN" = 1 ]]; then
    printf 'Expected a directory, but %s is a symlink.\n' "$TARGET_DIR" >&2
    exit 1
  fi
  printf 'Removing legacy symlink: %s\n' "$TARGET_DIR"
  rm "$TARGET_DIR"
fi

if [[ "$CHECK" = 0 ]] && [[ "$DRY_RUN" = 0 ]]; then
  mkdir -p "$TARGET_DIR"
fi

# Collect all canonical skills from skills/<category>/<skill-name>/SKILL.md.
declare -A WANT_DIRS

# Warn about SKILL.md files placed at depths other than a valid skill directory.
while IFS= read -r -d '' misplaced; do
  printf 'Warning: SKILL.md found at unexpected depth: %s\n' "$misplaced" >&2
done < <(find "$SOURCE_DIR" -mindepth 1 -maxdepth 2 -name SKILL.md -print0)

# shellcheck source=scan-skills.sh
source "$(dirname "$0")/scan-skills.sh"

for skill_dir in "${SKILL_DIRS[@]}"; do
  rel_dir=${skill_dir#"${SOURCE_DIR}/"}
  name=$(basename "$rel_dir")
  category=$(dirname "$rel_dir")

  if [[ -n "${WANT_DIRS[$name]:-}" ]]; then
    printf 'Duplicate skill name: %s (skills/%s/%s and skills/%s/%s)\n' \
      "$name" "$category" "$name" "${WANT_DIRS[$name]}" "$name" >&2
    exit 1
  fi

  if [[ "${RESERVED_SET[$name]:-}" = "1" ]]; then
    printf 'Reserved skill name: %s conflicts with a built-in command.\n' "$name" >&2
    printf 'Rename the skill to avoid shadowing the built-in /%s command.\n' "$name" >&2
    exit 1
  fi

  WANT_DIRS[$name]=$category
done

# Load externally-installed skills from skills-lock.json so install.sh
# preserves them (they are owned by `npx skills add`, not this repo's
# skills/ tree). Only entries with a non-local sourceType are external;
# `npx skills add .` records `sourceType: "local"` and those are still
# validated against skills/.
#
# Allowed sourceType values match the vercel-labs/skills schema
# (https://github.com/vercel-labs/skills): local, github, node_modules.
# Entries with missing or unknown values are rejected (fail closed) so a
# malformed lockfile entry cannot accidentally mark an entry as external
# and shield it from stale-entry cleanup.
declare -A EXTERNAL_DIRS
LOCKFILE="${REPO_ROOT}/skills-lock.json"
if [[ -f "$LOCKFILE" ]]; then
  if ! command -v jq >/dev/null 2>&1; then
    # jq is strongly recommended but not strictly required: we degrade to
    # "no external preservation" instead of hard-failing. A running install
    # without jq may still delete external skills on `--force` runs, but
    # the default install already never deletes anything in the absence of
    # stale cleanup mismatches.
    printf 'Warning: jq is not installed. External skills listed in %s will not be preserved; install jq (e.g. `apt-get install jq` / `brew install jq`) for full support.\n' "$LOCKFILE" >&2
  elif ! jq_output=$(jq -r --argjson known '["local","github","node_modules"]' '
      .skills // {} | to_entries[]
      | select((.value.sourceType // "") as $t | ($known | index($t)))
      | "\(.key)\t\(.value.sourceType)"
    ' "$LOCKFILE" 2>/dev/null); then
    printf 'Error: failed to parse %s as JSON.\n' "$LOCKFILE" >&2
    printf 'Run `npx skills update` to regenerate, or remove the lockfile.\n' >&2
    exit 1
  else
    # Verify no declared entries were silently dropped (fail-closed on
    # entries with missing or unknown sourceType).
    declared=$(jq -r '.skills // {} | keys[]' "$LOCKFILE" 2>/dev/null | sort)
    processed=$(printf '%s\n' "$jq_output" | awk -F'\t' 'NF>=1 && $1 != "" {print $1}' | sort)
    if [[ "$declared" != "$processed" ]]; then
      bad=$(comm -23 <(printf '%s\n' "$declared") <(printf '%s\n' "$processed") | tr '\n' ' ')
      printf 'Error: %s has entries with missing or unknown sourceType (fail-closed).\n' "$LOCKFILE" >&2
      printf '  Affected names: %s\n' "$bad" >&2
      printf '  Allowed sourceType values: local, github, node_modules.\n' >&2
      printf '  Run `npx skills update` to regenerate.\n' >&2
      exit 1
    fi
    while IFS=$'\t' read -r lock_name lock_source_type; do
      [[ -n "$lock_name" ]] || continue
      if [[ "$lock_source_type" != "local" ]]; then
        EXTERNAL_DIRS[$lock_name]=1
      fi
    done <<< "$jq_output"
  fi
fi

# Compute symlink targets (relative for portability) and ensure/verify links.
for name in $(printf '%s\n' "${!WANT_DIRS[@]}" | sort); do
  category="${WANT_DIRS[$name]}"
  skill_dir="${SOURCE_DIR}/${category}/${name}"
  link="${TARGET_DIR}/${name}"
  if [[ "$COPY" = 1 ]]; then
    # Copy mode: the target directory holds a fresh copy of every source
    # skill. The install is idempotent — a second run replaces prior
    # copies — and --check compares file contents rather than relying on a
    # symlink target. Recognised managed entries (those carrying the
    # $MANAGED_MARKER sentinel) refresh in place even when source content
    # has changed; the stale-entry removal loop stays gated by FORCE.
    #
    # On a managed copy-mode install we drop $MANAGED_MARKER into the entry
    # so future re-runs can recognise "this is ours" and refresh in place
    # even when the source content has changed (a normal upgrade). The
    # marker also keeps the safety guard from clobbering same-named
    # hand-placed content under --target / --home / repo-local.
    #
    # Note: `[[ ! -e $link && ! -L $link ]]` is true only when nothing
    # occupies the slot — including dangling symlinks, which we treat as
    # user-placed content and refuse unless --force or a managed marker
    # is present. This avoids silently clobbering a hand-placed dangling
    # link with a fresh directory.
    if [[ ! -e "$link" && ! -L "$link" ]]; then
      if [[ "$CHECK" = 1 ]] || [[ "$DRY_RUN" = 1 ]]; then
        printf 'Would create: %s (copy from %s)\n' "$link" "$skill_dir"
        DIFF=1
      else
        printf 'Creating: %s (copy from %s)\n' "$link" "$skill_dir"
        cp -R "$skill_dir" "$link"
        write_managed_marker "$link"
      fi
      continue
    fi

    # Entry already exists. In CHECK mode, compare its content against the
    # source: a matching tree is "in sync", otherwise report the would-be
    # replacement so DIFF=1.
    if [[ "$CHECK" = 1 ]]; then
      if content_matches "$skill_dir" "$link"; then
        continue
      fi
      printf 'Would replace: %s (content differs from %s)\n' "$link" "$skill_dir"
      DIFF=1
      continue
    fi
    if [[ "$DRY_RUN" = 1 ]]; then
      printf 'Would replace: %s (copy from %s)\n' "$link" "$skill_dir"
      DIFF=1
      continue
    fi

    # Real install. Three replaceable cases:
    #   1. --force is explicit.
    #   2. The entry is a symlink whose target already matches the expected
    #      source path — we created it (mode switch) and may switch back.
    #   3. The entry is a directory carrying our managed marker from a prior
    #      copy-mode install; refresh in place even when the source content
    #      has changed (upgrade).
    # Foreign hand-placed symlinks, directories, and files are refused so
    # user content is not silently clobbered.
    expected_target=$(relpath "$skill_dir" "$BASE_ABS" 2>/dev/null || printf '')
    if [[ "$FORCE" = 1 ]]; then
      : # explicit override
    elif [[ -L "$link" ]]; then
      current=$(readlink "$link" 2>/dev/null || true)
      if [[ -z "$current" ]]; then
        printf 'Refusing to overwrite dangling symlink %s (use --force to override).\n' "$link" >&2
        exit 1
      fi
      if [[ "$current" != "$expected_target" ]]; then
        printf 'Refusing to overwrite foreign symlink %s -> %s (use --force to override).\n' "$link" "$current" >&2
        exit 1
      fi
    elif [[ ! -e "$link" ]]; then
      # Survived `[[ ! -e $link && ! -L $link ]]` because the target is a
      # symlink (caught above) — but if -L is also false we're seeing
      # something exotic. Be safe and refuse.
      printf 'Refusing to overwrite %s (unrecognised state; use --force to override).\n' "$link" >&2
      exit 1
    elif [[ ! -f "$link/$MANAGED_MARKER" ]]; then
      printf 'Refusing to overwrite unmanaged %s (use --force to override).\n' "$link" >&2
      exit 1
    fi
    printf 'Replacing: %s (copy from %s)\n' "$link" "$skill_dir"
    rm -rf "$link"
    cp -R "$skill_dir" "$link"
    write_managed_marker "$link"
    continue
  fi

  if ! target=$(relpath "$skill_dir" "$BASE_ABS"); then
    printf 'Unable to compute relative path for %s\n' "$skill_dir" >&2
    exit 1
  fi
  if [[ -z "$target" ]]; then
    printf 'Computed empty relative path for %s\n' "$skill_dir" >&2
    exit 1
  fi

  if [[ -L "$link" ]]; then
    current=$(readlink "$link" || true)
    if [[ "$current" = "$target" ]]; then
      continue
    fi
    if [[ "$CHECK" = 1 ]] || [[ "$DRY_RUN" = 1 ]]; then
      printf 'Would retarget: %s -> %s (currently %s)\n' "$link" "$target" "$current"
      DIFF=1
    else
      printf 'Retargeting: %s -> %s\n' "$link" "$target"
      rm "$link"
      ln -s "$target" "$link"
    fi
  elif [[ -e "$link" ]]; then
    if [[ "$CHECK" = 1 ]] || [[ "$DRY_RUN" = 1 ]]; then
      printf 'Would replace: %s -> %s\n' "$link" "$target"
      DIFF=1
    elif [[ "$FORCE" = 1 ]]; then
      printf 'Replacing: %s -> %s\n' "$link" "$target"
      rm -rf "$link"
      ln -s "$target" "$link"
    else
      printf 'Refusing to replace existing %s (not a symlink). Use --force to override.\n' "$link" >&2
      exit 1
    fi
  else
    if [[ "$CHECK" = 1 ]] || [[ "$DRY_RUN" = 1 ]]; then
      printf 'Would create: %s -> %s\n' "$link" "$target"
      DIFF=1
    else
      printf 'Creating: %s -> %s\n' "$link" "$target"
      ln -s "$target" "$link"
    fi
  fi
done

# Positive presence check: every external entry declared in skills-lock.json
# should have a corresponding .agents/skills/<name> directory (created by
# `npx skills add`). On --check we report mismatches but never auto-create,
# because install.sh does not know the external source path; the wrapper
# (`bin/skills.ts`) is responsible for materialising externals before
# delegating here. On a non-check install we warn but continue, since
# re-running `npx skills add <source>` is the correct remediation.
for name in $(printf '%s\n' "${!EXTERNAL_DIRS[@]}" | sort); do
  ext_path="${TARGET_DIR}/${name}"
  if [[ ! -e "$ext_path" ]]; then
    if [[ "$CHECK" = 1 ]] || [[ "$DRY_RUN" = 1 ]]; then
      printf 'External skill missing: %s (run `npx skills add` to install).\n' "$name" >&2
      DIFF=1
    else
      printf 'External skill missing: %s (run `npx skills add` to install; skip by editing skills-lock.json).\n' "$name" >&2
    fi
  fi
done

# Remove stale entries in the target directory.
# When `skills-lock.json` is absent, install.sh has no source of truth for
# which `.agents/skills/<name>` entries are external (owned by `npx skills`)
# vs stale. In that mode we skip the leftover-removal pass entirely to
# avoid silently deleting externally-installed skills; users can still
# remove manually with `--check` + targeted `rm`, or commit the lockfile
# to restore the proper contract.
if [[ ! -f "$LOCKFILE" ]]; then
  if [[ "$CHECK" = 1 ]] || [[ "$DRY_RUN" = 1 ]]; then
    printf 'Note: %s not found; skipping stale-entry cleanup. Run `npx skills` to add the lockfile.\n' "$LOCKFILE" >&2
    DIFF=1
  fi
elif [[ -d "$TARGET_DIR" ]]; then
  while IFS= read -r -d '' entry; do
    name=$(basename "$entry")
    if [[ -z "${WANT_DIRS[$name]:-}" ]]; then
      if [[ "${EXTERNAL_DIRS[$name]:-}" = "1" ]]; then
        # External skill installed via `npx skills add`. Owned by the
        # lockfile, not by this repo's skills/ tree. Preserve it.
        continue
      fi
      if [[ "$CHECK" = 1 ]] || [[ "$DRY_RUN" = 1 ]]; then
        printf 'Would remove stale entry: %s\n' "$entry"
        DIFF=1
      elif [[ "$FORCE" = 1 ]]; then
        printf 'Removing stale entry: %s\n' "$entry"
        rm -rf "$entry"
      else
        printf 'Refusing to remove stale entry %s (not a skill). Use --force to override.\n' "$entry" >&2
        exit 1
      fi
    fi
  done < <(find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -print0)
fi

if [[ "$CHECK" = 1 ]]; then
  if [[ "$DIFF" = 1 ]]; then
    printf '%s\n' '.agents/skills is out of sync.' >&2
    exit 1
  fi
  printf '%s\n' '.agents/skills is in sync.'
fi

if [[ "$CHECK" = 0 ]] && [[ "$DRY_RUN" = 0 ]]; then
  if [[ "$COPY" = 1 ]]; then
    printf '%d skills installed in %s\n' ${#WANT_DIRS[@]} "$TARGET_DIR"
  else
    printf '%d skills linked in %s\n' ${#WANT_DIRS[@]} "$TARGET_DIR"
  fi
fi

exit 0
