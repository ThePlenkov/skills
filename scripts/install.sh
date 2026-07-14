#!/usr/bin/env bash
# Install skills from this repo as flat symlinks into an .agents/skills directory.
#
# Default (project install): creates .agents/skills/<skill-name> symlinks in the repo.
# --home: creates ~/.agents/skills/<skill-name> symlinks (dotfiles / global install).
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
    --help)
      printf 'Usage: %s [--home] [--dry-run|--check] [--force]\n' "$(basename "$0")"
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$arg" >&2
      exit 1
      ;;
  esac
done

# shellcheck source=ensure-reserved.sh
source "$(dirname "$0")/ensure-reserved.sh"

if [[ "$HOME_INSTALL" = 1 ]]; then
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

# Compute symlink targets (relative for portability) and ensure/verify links.
for name in $(printf '%s\n' "${!WANT_DIRS[@]}" | sort); do
  category="${WANT_DIRS[$name]}"
  skill_dir="${SOURCE_DIR}/${category}/${name}"
  link="${TARGET_DIR}/${name}"
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

# Remove stale entries in the target directory.
if [[ -d "$TARGET_DIR" ]]; then
  while IFS= read -r -d '' entry; do
    name=$(basename "$entry")
    if [[ -z "${WANT_DIRS[$name]:-}" ]]; then
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
  printf '%d skills linked in %s\n' ${#WANT_DIRS[@]} "$TARGET_DIR"
fi

exit 0
