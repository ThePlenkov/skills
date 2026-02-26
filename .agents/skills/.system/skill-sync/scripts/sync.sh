#!/usr/bin/env bash
#
# skill-sync: Synchronize skills from multiple source repos into ~/.agents/skills/
#
# Usage:
#   sync.sh [--dry-run] [--verbose] [--config PATH]
#
# Reads ~/.agents/skills.json (or --config PATH) and creates flat symlinks
# in the target directory using prefix-based naming.
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

# --- Validate dependencies ---
command -v jq >/dev/null 2>&1 || die "jq is required but not installed"

# --- Read config ---
[[ -f "$CONFIG_PATH" ]] || die "Config not found: $CONFIG_PATH"

log "Reading config from $CONFIG_PATH"

TARGET_RAW=$(jq -r '.target // "~/.agents/skills"' "$CONFIG_PATH")
TARGET_DIR="${TARGET_RAW/#\~/$HOME}"

# --- Ensure target directory exists ---
if [[ ! -d "$TARGET_DIR" ]]; then
  if $DRY_RUN; then
    log "Would create directory: $TARGET_DIR"
  else
    mkdir -p "$TARGET_DIR"
    log "Created directory: $TARGET_DIR"
  fi
fi

# --- Collect desired symlinks ---
declare -A DESIRED_LINKS  # name -> target_path
COLLISIONS=()

# Read sources from JSON
SOURCES=$(jq -r '.sources | to_entries[] | "\(.key)\t\(.value)"' "$CONFIG_PATH")

while IFS=$'\t' read -r prefix source_repo; do
  [[ -z "$prefix" ]] && continue

  SKILLS_DIR="${source_repo}/.agents/skills"

  if [[ ! -d "$SKILLS_DIR" ]]; then
    warn "Skills directory not found: $SKILLS_DIR (source: $prefix)"
    continue
  fi

  verbose "Scanning source '$prefix': $SKILLS_DIR"

  # Find all SKILL.md files
  while IFS= read -r skill_md; do
    # Get the skill directory (parent of SKILL.md)
    skill_dir=$(dirname "$skill_md")

    # Compute relative path from .agents/skills/ to the skill directory
    rel_path="${skill_dir#"${SKILLS_DIR}/"}"

    # Skip if SKILL.md is directly in .agents/skills/ (not in a subdirectory)
    if [[ "$rel_path" == "$skill_dir" ]]; then
      continue
    fi

    # Strip leading dots from path segments (e.g., .system -> system)
    rel_path=$(echo "$rel_path" | sed 's#/\.#/#g; s#^\.##')

    # Flatten: replace / with -
    flat_name="${rel_path//\//-}"

    # Build the prefixed name
    link_name="${prefix}-${flat_name}"

    # Validate name against spec: lowercase alphanumeric and hyphens only
    if [[ ! "$link_name" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
      warn "Skipping invalid name: $link_name (from $skill_md)"
      continue
    fi

    # Check for consecutive hyphens
    if [[ "$link_name" == *--* ]]; then
      warn "Skipping name with consecutive hyphens: $link_name (from $skill_md)"
      continue
    fi

    # Check for collisions
    if [[ -v "DESIRED_LINKS[$link_name]" ]]; then
      warn "Name collision: $link_name"
      warn "  Existing: ${DESIRED_LINKS[$link_name]}"
      warn "  New:      $skill_dir"
      COLLISIONS+=("$link_name")
      continue
    fi

    DESIRED_LINKS["$link_name"]="$skill_dir"
    verbose "  $link_name -> $skill_dir"

  done < <(find "$SKILLS_DIR" -name "SKILL.md" -type f 2>/dev/null)

done <<< "$SOURCES"

# --- Report collisions ---
if [[ ${#COLLISIONS[@]} -gt 0 ]]; then
  warn "${#COLLISIONS[@]} collision(s) detected. Resolve by renaming skills or adjusting source prefixes."
fi

# --- Phase 1: Remove stale symlinks ---
REMOVED=0
if [[ -d "$TARGET_DIR" ]]; then
  while IFS= read -r existing_link; do
    [[ -z "$existing_link" ]] && continue
    link_basename=$(basename "$existing_link")

    if [[ ! -v "DESIRED_LINKS[$link_basename]" ]]; then
      # Only remove if it's a symlink (never touch regular files/dirs)
      if [[ -L "$existing_link" ]]; then
        if $DRY_RUN; then
          log "Would remove stale symlink: $link_basename"
        else
          rm "$existing_link"
          verbose "Removed stale symlink: $link_basename"
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

    # Update existing symlink
    if $DRY_RUN; then
      log "Would update: $link_name -> $target"
    else
      rm "$link_path"
      ln -s "$target" "$link_path"
      verbose "Updated: $link_name -> $target"
    fi
    UPDATED=$((UPDATED + 1))
  elif [[ -e "$link_path" ]]; then
    warn "Skipping $link_name: path exists and is not a symlink"
  else
    # Create new symlink
    if $DRY_RUN; then
      log "Would create: $link_name -> $target"
    else
      ln -s "$target" "$link_path"
      verbose "Created: $link_name -> $target"
    fi
    CREATED=$((CREATED + 1))
  fi
done

# --- Summary ---
log "Sync complete: ${CREATED} created, ${UPDATED} updated, ${REMOVED} removed, ${UNCHANGED} unchanged"

if $DRY_RUN; then
  log "(dry-run mode — no changes were made)"
fi
