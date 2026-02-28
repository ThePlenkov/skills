#!/usr/bin/env bash
#
# skill-sync: Synchronize skills from multiple source repos into target directories
#
# Usage:
#   sync.sh [--dry-run] [--verbose] [--config PATH]
#
# Reads ~/.agents/skills.json (or --config PATH).
#
# Config schema:
#   sources: array of { prefix, path, include? }
#     - prefix:  short name used in flat link naming
#     - path:    path to root of the skills repo
#     - include: optional array of glob patterns relative to .agents/skills/
#                (e.g. ["tools/**", ".system/**"])
#   targets: array of { path, flat?, name_style?, sources? }
#     - path:       destination directory (~ expanded)
#     - flat:       true  = create flat symlinks (default: true)
#                   false = create one symlink per source (link name = prefix)
#     - name_style: 'prefix' (default) = {prefix}-{flat-path}
#                   'basename'         = skill directory name only (must be unique)
#     - sources:    optional array of source prefixes to include (default: all)
#

set -euo pipefail

# --- Defaults ---
CONFIG_PATH="${HOME}/.agents/skills.json"
DRY_RUN=false
VERBOSE=false

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN=true; shift ;;
    --verbose)  VERBOSE=true; shift ;;
    --config)   CONFIG_PATH="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: sync.sh [--dry-run] [--verbose] [--config PATH]"
      echo ""
      echo "Options:"
      echo "  --dry-run   Preview changes without applying them"
      echo "  --verbose   Show detailed output"
      echo "  --config    Path to skills.json (default: ~/.agents/skills.json)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# --- Helpers ---
log()     { echo "[skill-sync] $*"; }
verbose() { $VERBOSE && echo "[skill-sync]   $*" || true; }
warn()    { echo "[skill-sync] WARNING: $*" >&2; }
die()     { echo "[skill-sync] ERROR: $*" >&2; exit 1; }

expand_path() { echo "${1/#\~/$HOME}"; }

# Returns 0 if the given relative path matches any of the given glob patterns.
# Patterns are standard shell globs (e.g. "tools/**", ".system/dotagents").
matches_include() {
  local rel_path="$1"
  shift
  local pattern
  for pattern in "$@"; do
    # Use bash globbing via case
    # shellcheck disable=SC2254
    case "$rel_path" in
      $pattern) return 0 ;;
    esac
  done
  return 1
}

# --- Validate dependencies ---
command -v jq >/dev/null 2>&1 || die "jq is required but not installed"

# --- Read config ---
[[ -f "$CONFIG_PATH" ]] || die "Config not found: $CONFIG_PATH"

log "Reading config from $CONFIG_PATH"

# --- Detect config schema version ---
# New schema: sources is an array. Old schema: sources is an object.
IS_NEW_SCHEMA=$(jq -r 'if (.sources | type) == "array" then "true" else "false" end' "$CONFIG_PATH")

if [[ "$IS_NEW_SCHEMA" == "false" ]]; then
  die "Unsupported legacy config format. Please migrate to the new schema (sources: array, targets: array). See skills.json.example."
fi

# --- Parse sources into associative arrays ---
declare -A SOURCE_PATH    # prefix -> repo path
declare -A SOURCE_INCLUDE # prefix -> tab-separated include patterns (empty = all)
SOURCE_PREFIXES=()

while IFS=$'\t' read -r prefix path includes; do
  SOURCE_PATH["$prefix"]="$path"
  SOURCE_INCLUDE["$prefix"]="$includes"
  SOURCE_PREFIXES+=("$prefix")
done < <(jq -r '.sources[] | [.prefix, .path, (.include // [] | join("\t"))] | join("\t")' "$CONFIG_PATH")

# --- Process each target ---
TOTAL_CREATED=0
TOTAL_UPDATED=0
TOTAL_REMOVED=0
TOTAL_UNCHANGED=0

TARGET_COUNT=$(jq '.targets | length' "$CONFIG_PATH")

for (( ti=0; ti<TARGET_COUNT; ti++ )); do
  TARGET_RAW=$(jq -r ".targets[$ti].path" "$CONFIG_PATH")
  TARGET_DIR=$(expand_path "$TARGET_RAW")
  FLAT=$(jq -r ".targets[$ti].flat | if . == null then true else . end" "$CONFIG_PATH")
  NAME_STYLE=$(jq -r ".targets[$ti].name_style // \"prefix\"" "$CONFIG_PATH")
  # Sources filter: array of prefixes, or null meaning all
  SOURCES_FILTER=$(jq -r ".targets[$ti].sources // [] | join(\"	\")" "$CONFIG_PATH")

  log "Target: $TARGET_DIR (flat=$FLAT, name_style=$NAME_STYLE)"

  # Build list of applicable source prefixes for this target
  APPLICABLE_PREFIXES=()
  if [[ -z "$SOURCES_FILTER" ]]; then
    APPLICABLE_PREFIXES=("${SOURCE_PREFIXES[@]}")
  else
    IFS=$'\t' read -ra FILTER_LIST <<< "$SOURCES_FILTER"
    for prefix in "${FILTER_LIST[@]}"; do
      if [[ -v "SOURCE_PATH[$prefix]" ]]; then
        APPLICABLE_PREFIXES+=("$prefix")
      else
        warn "Target $TARGET_DIR references unknown source prefix: $prefix"
      fi
    done
  fi

  # --- Ensure target directory exists ---
  if [[ ! -d "$TARGET_DIR" ]]; then
    if $DRY_RUN; then
      log "  Would create directory: $TARGET_DIR"
    else
      mkdir -p "$TARGET_DIR"
      verbose "Created directory: $TARGET_DIR"
    fi
  fi

  # --- Collect desired symlinks for this target ---
  declare -A DESIRED_LINKS  # link_name -> absolute_target_path
  COLLISIONS=()

  for prefix in "${APPLICABLE_PREFIXES[@]}"; do
    source_repo="${SOURCE_PATH[$prefix]}"
    SKILLS_DIR="${source_repo}/.agents/skills"
    RAW_INCLUDES="${SOURCE_INCLUDE[$prefix]}"

    if [[ ! -d "$SKILLS_DIR" ]]; then
      warn "Skills directory not found: $SKILLS_DIR (source: $prefix)"
      continue
    fi

    if [[ "$FLAT" == "true" ]]; then
      # --- FLAT MODE: one symlink per skill, named {prefix}-{flat-path} ---
      verbose "Scanning source '$prefix' (flat): $SKILLS_DIR"

      while IFS= read -r skill_md; do
        skill_dir=$(dirname "$skill_md")
        rel_path="${skill_dir#"${SKILLS_DIR}/"}"

        # Skip SKILL.md directly in .agents/skills/ root
        [[ "$rel_path" == "$skill_dir" ]] && continue

        # Apply include filter if set
        if [[ -n "$RAW_INCLUDES" ]]; then
          IFS=$'\t' read -ra INCLUDE_PATTERNS <<< "$RAW_INCLUDES"
          if ! matches_include "$rel_path" "${INCLUDE_PATTERNS[@]}"; then
            verbose "  Skipping (filtered): $rel_path"
            continue
          fi
        fi

        # Determine link name based on name_style
        if [[ "$NAME_STYLE" == "basename" ]]; then
          link_name=$(basename "$skill_dir")
        else
          # Strip leading dots from path segments (.system -> system)
          rel_path=$(echo "$rel_path" | sed 's#/\.#/#g; s#^\.##')
          # Flatten: replace / with -
          flat_name="${rel_path//\//-}"
          link_name="${prefix}-${flat_name}"
        fi

        # Validate name
        if [[ ! "$link_name" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] || [[ "$link_name" == *--* ]]; then
          warn "Skipping invalid name: $link_name (from $skill_md)"
          continue
        fi

        if [[ -v "DESIRED_LINKS[$link_name]" ]]; then
          warn "Name collision: $link_name (skipping $skill_dir)"
          COLLISIONS+=("$link_name")
          continue
        fi

        DESIRED_LINKS["$link_name"]="$skill_dir"
        verbose "  $link_name -> $skill_dir"

      done < <(find "$SKILLS_DIR" -name "SKILL.md" -type f 2>/dev/null)

    else
      # --- STRUCTURED MODE: one symlink per source, preserving directory structure ---
      # Link name is just the prefix; target is the source .agents/skills/ directory
      verbose "Scanning source '$prefix' (structured): $SKILLS_DIR"

      link_name="$prefix"

      if [[ -v "DESIRED_LINKS[$link_name]" ]]; then
        warn "Name collision: $link_name (skipping $source_repo)"
        COLLISIONS+=("$link_name")
        continue
      fi

      DESIRED_LINKS["$link_name"]="$SKILLS_DIR"
      verbose "  $link_name -> $SKILLS_DIR"
    fi
  done

  [[ ${#COLLISIONS[@]} -gt 0 ]] && warn "${#COLLISIONS[@]} collision(s) in target $TARGET_DIR"

  # --- Phase 1: Remove stale symlinks ---
  REMOVED=0
  if [[ -d "$TARGET_DIR" ]]; then
    while IFS= read -r existing_link; do
      [[ -z "$existing_link" ]] && continue
      link_basename=$(basename "$existing_link")

      if [[ ! -v "DESIRED_LINKS[$link_basename]" ]]; then
        if [[ -L "$existing_link" ]]; then
          if $DRY_RUN; then
            log "  Would remove stale: $link_basename"
          else
            rm "$existing_link"
            verbose "Removed stale: $link_basename"
          fi
          REMOVED=$((REMOVED + 1))
        fi
      fi
    done < <(find "$TARGET_DIR" -maxdepth 1 -type l 2>/dev/null)
  fi

  # --- Phase 2: Create/update symlinks ---
  CREATED=0
  UPDATED=0
  UNCHANGED=0

  for link_name in "${!DESIRED_LINKS[@]}"; do
    target="${DESIRED_LINKS[$link_name]}"
    link_path="${TARGET_DIR}/${link_name}"

    if [[ -L "$link_path" ]]; then
      current_target=$(readlink -f "$link_path" 2>/dev/null || echo "")
      resolved_target=$(readlink -f "$target" 2>/dev/null || echo "$target")

      if [[ "$current_target" == "$resolved_target" ]]; then
        verbose "Unchanged: $link_name"
        UNCHANGED=$((UNCHANGED + 1))
        continue
      fi

      if $DRY_RUN; then
        log "  Would update: $link_name -> $target"
      else
        rm "$link_path"
        ln -s "$target" "$link_path"
        verbose "Updated: $link_name -> $target"
      fi
      UPDATED=$((UPDATED + 1))
    elif [[ -e "$link_path" ]]; then
      warn "Skipping $link_name: path exists and is not a symlink"
    else
      if $DRY_RUN; then
        log "  Would create: $link_name -> $target"
      else
        ln -s "$target" "$link_path"
        verbose "Created: $link_name -> $target"
      fi
      CREATED=$((CREATED + 1))
    fi
  done

  log "  Done: ${CREATED} created, ${UPDATED} updated, ${REMOVED} removed, ${UNCHANGED} unchanged"

  TOTAL_CREATED=$((TOTAL_CREATED + CREATED))
  TOTAL_UPDATED=$((TOTAL_UPDATED + UPDATED))
  TOTAL_REMOVED=$((TOTAL_REMOVED + REMOVED))
  TOTAL_UNCHANGED=$((TOTAL_UNCHANGED + UNCHANGED))

  unset DESIRED_LINKS
  declare -A DESIRED_LINKS
done

# --- Summary ---
log "Sync complete: ${TOTAL_CREATED} created, ${TOTAL_UPDATED} updated, ${TOTAL_REMOVED} removed, ${TOTAL_UNCHANGED} unchanged"

if $DRY_RUN; then
  log "(dry-run mode — no changes were made)"
fi
