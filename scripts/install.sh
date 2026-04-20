#!/usr/bin/env bash
# Install skills from this repo into per-agent skill directories.
#
# Replaces `npx skills add . --all -y`, which has a destructive bug:
# it empties .agents/skills/*/SKILL.md in the source tree and creates
# ~30 unused sibling `.{agent}/` directories in the repo root.
#
# Strategy: relative symlinks from each target into the canonical
# `~/.agents/skills/personal/<name>` path (which is itself a symlink
# to this repo's `.agents/skills/`). No content is duplicated; editing
# a SKILL.md here instantly propagates to every agent.
#
# Usage:
#   scripts/install.sh              # install into auto-detected targets
#   scripts/install.sh --dry-run    # print what would change, do nothing
#   scripts/install.sh --list       # list detected skills and targets
#   scripts/install.sh --target ~/.claude/skills --target ~/.codex/skills
#                                   # explicit targets
#
# Safe to re-run; existing correct symlinks are left alone.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="${REPO_ROOT}/.agents/skills"
PERSONAL_LINK="${HOME}/.agents/skills/personal"

# Default targets: any ~/.{agent}/skills/ dir that already exists.
DEFAULT_TARGETS=(
  "${HOME}/.claude/skills"
  "${HOME}/.codex/skills"
  "${HOME}/.cursor/skills"
  "${HOME}/.windsurf/skills"
)

DRY_RUN=0
LIST_ONLY=0
EXPLICIT_TARGETS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --list)    LIST_ONLY=1; shift ;;
    --target)  EXPLICIT_TARGETS+=("$2"); shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

# ── Resolve the personal/ anchor ─────────────────────────────────────
# Target symlinks point to `../../.agents/skills/personal/<name>`, which
# resolves to this repo via ~/.agents/skills/personal. If that link is
# missing, create it — this is a one-time setup for the whole repo.
if [ ! -L "$PERSONAL_LINK" ]; then
  if [ -e "$PERSONAL_LINK" ]; then
    echo "❌ $PERSONAL_LINK exists and is not a symlink. Remove or rename it first." >&2
    exit 1
  fi
  mkdir -p "$(dirname "$PERSONAL_LINK")"
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] ln -sfn $SOURCE_DIR $PERSONAL_LINK"
  else
    ln -sfn "$SOURCE_DIR" "$PERSONAL_LINK"
    echo "✓ linked $PERSONAL_LINK → $SOURCE_DIR"
  fi
elif [ "$(readlink -f "$PERSONAL_LINK")" != "$(readlink -f "$SOURCE_DIR")" ]; then
  echo "⚠️  $PERSONAL_LINK → $(readlink "$PERSONAL_LINK")"
  echo "    expected → $SOURCE_DIR"
  echo "    Leaving as-is. Re-point manually if you want this repo to own it."
fi

# ── Collect skills ───────────────────────────────────────────────────
SKILLS=()
for dir in "$SOURCE_DIR"/*/; do
  [ -f "${dir}SKILL.md" ] || continue
  SKILLS+=("$(basename "$dir")")
done

if [ ${#SKILLS[@]} -eq 0 ]; then
  echo "❌ No skills with SKILL.md found under $SOURCE_DIR" >&2
  exit 1
fi

# ── Resolve targets ──────────────────────────────────────────────────
TARGETS=()
if [ ${#EXPLICIT_TARGETS[@]} -gt 0 ]; then
  TARGETS=("${EXPLICIT_TARGETS[@]}")
else
  for t in "${DEFAULT_TARGETS[@]}"; do
    [ -d "$t" ] && TARGETS+=("$t")
  done
fi

if [ ${#TARGETS[@]} -eq 0 ]; then
  echo "❌ No skill target directories found." >&2
  echo "   Tried: ${DEFAULT_TARGETS[*]}" >&2
  echo "   Pass --target <dir> explicitly or create one of the above." >&2
  exit 1
fi

if [ "$LIST_ONLY" = "1" ]; then
  echo "Skills (${#SKILLS[@]}):"
  printf '  - %s\n' "${SKILLS[@]}"
  echo
  echo "Targets (${#TARGETS[@]}):"
  printf '  - %s\n' "${TARGETS[@]}"
  exit 0
fi

# ── Install ──────────────────────────────────────────────────────────
# Symlink path: <target>/<name> → ../../.agents/skills/personal/<name>
# This matches the convention used by skills already installed from
# ~/.agents/skills/<name> to ~/.{agent}/skills/<name>.
installed=0; skipped=0; updated=0
for target in "${TARGETS[@]}"; do
  [ -d "$target" ] || {
    if [ "$DRY_RUN" = "1" ]; then
      echo "[dry-run] mkdir -p $target"
    else
      mkdir -p "$target"
    fi
  }
  for skill in "${SKILLS[@]}"; do
    link="$target/$skill"
    dest="../../.agents/skills/personal/$skill"

    if [ -L "$link" ]; then
      current="$(readlink "$link")"
      if [ "$current" = "$dest" ]; then
        skipped=$((skipped + 1))
        continue
      fi
      if [ "$DRY_RUN" = "1" ]; then
        echo "[dry-run] retarget $link: $current → $dest"
      else
        ln -sfn "$dest" "$link"
      fi
      updated=$((updated + 1))
    elif [ -e "$link" ]; then
      echo "⚠️  $link exists and is not a symlink — skipped."
      continue
    else
      if [ "$DRY_RUN" = "1" ]; then
        echo "[dry-run] ln -s $dest $link"
      else
        ln -s "$dest" "$link"
      fi
      installed=$((installed + 1))
    fi
  done
done

echo "✓ skills: ${#SKILLS[@]}, targets: ${#TARGETS[@]}"
echo "  installed=$installed, updated=$updated, already-correct=$skipped"
if [ "$DRY_RUN" = "1" ]; then
  echo "  (dry-run — no changes written)"
fi
