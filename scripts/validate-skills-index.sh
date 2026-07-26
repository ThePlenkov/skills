#!/usr/bin/env bash
# Validate the generated skills index and optionally write it to disk.
#
# By default this script:
#   * regenerates the index and schema in a tmp dir using the TypeScript generator
#   * validates the generated index against the generated schema using the locally installed ajv-cli
#   * if .claude-plugin/skills-index.json exists, compares the generated index against it
#
# Usage:
#   scripts/validate-skills-index.sh [--update] [--output PATH]
#
# --update: write the generated (and validated) index and schema to the default
#   paths (.claude-plugin/skills-index.json and .claude-plugin/skills-index.schema.json).
#   Useful in CI to produce artifacts.
# --output PATH: write the generated (and validated) index to PATH instead.
# --help: show this message.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
DEFAULT_INDEX_PATH="${REPO_ROOT}/.claude-plugin/skills-index.json"
DEFAULT_SCHEMA_PATH="${REPO_ROOT}/.claude-plugin/skills-index.schema.json"

OUTPUT_PATH=""
UPDATE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --update)
      UPDATE=1
      shift
      ;;
    --output)
      if [[ -z "${2:-}" ]]; then
        echo "error: --output requires a path" >&2
        exit 2
      fi
      OUTPUT_PATH="$2"
      shift 2
      ;;
    --help)
      # Print the header comments from line 2 up to the first blank line.
      sed -n '2,/^$/p' "$0"
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# --update is a convenience alias for the default index and schema paths.
if [[ "$UPDATE" = 1 && -z "$OUTPUT_PATH" ]]; then
  OUTPUT_PATH="$DEFAULT_INDEX_PATH"
fi

# Keep temp files inside the gitignored tmp/ directory so they are not
# accidentally committed if the trap fails to fire.
mkdir -p "$REPO_ROOT/tmp"
TMP_DIR="$(mktemp -d "$REPO_ROOT/tmp/skills-index-XXXXXX")"
TMP_INDEX="$TMP_DIR/index.json"
TMP_SCHEMA="$TMP_DIR/schema.json"
trap 'rm -rf "$TMP_DIR"' EXIT

# Ensure Node dependencies are installed.
if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  echo "error: node_modules not found. Run 'npm install' first." >&2
  exit 1
fi

npx tsx "$SCRIPT_DIR/generate-skills-index.ts" --no-timestamp --root "$REPO_ROOT" --output "$TMP_INDEX" --schema "$TMP_SCHEMA" >/dev/null

# Validate the generated index against the JSON Schema using the locally installed ajv-cli.
AJV="$REPO_ROOT/node_modules/.bin/ajv"
if [[ -x "$AJV" ]]; then
  if ! "$AJV" validate -s "$TMP_SCHEMA" -d "$TMP_INDEX" --spec=draft7 --strict=false >/dev/null 2>&1; then
    echo "error: generated index does not match the generated schema" >&2
    "$AJV" validate -s "$TMP_SCHEMA" -d "$TMP_INDEX" --spec=draft7 --strict=false >&2 || true
    exit 1
  fi
else
  echo "warning: ajv-cli not installed; skipping JSON schema validation" >&2
fi

# Compare with an existing on-disk index *before* writing, so --update only
# overwrites when the generated index is actually different.
compare_with_existing() {
  local existing_path="$1"
  local generated_path="$2"

  local tmp_committed="$TMP_DIR/committed.json"
  local tmp_generated="$TMP_DIR/generated.json"
  cp "$existing_path" "$tmp_committed"
  cp "$generated_path" "$tmp_generated"

  node --input-type=module - "$tmp_committed" "$tmp_generated" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
for (const p of process.argv.slice(2)) {
  const data = JSON.parse(readFileSync(p, 'utf8'));
  delete data.generated_at;
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}
JS

  if diff -q "$tmp_committed" "$tmp_generated" >/dev/null 2>&1; then
    echo "✅ skills-index.json is in sync."
    return 0
  fi

  echo "❌ skills-index.json is out of sync with the filesystem:" >&2
  diff "$tmp_committed" "$tmp_generated" || true
  return 1
}

if [[ ! -f "$DEFAULT_INDEX_PATH" ]]; then
  echo "✅ generated skills-index.json is valid."
elif ! compare_with_existing "$DEFAULT_INDEX_PATH" "$TMP_INDEX"; then
  if [[ -z "$OUTPUT_PATH" ]]; then
    echo >&2
    echo "Run 'scripts/validate-skills-index.sh --update' to refresh." >&2
    exit 1
  fi
  # OUTPUT_PATH is set: the index will be overwritten below.
fi

write_output() {
  local target_path="$1"
  local source_path="$2"

  if [[ ! "$target_path" = /* ]]; then
    target_path="${REPO_ROOT}/${target_path}"
  fi

  mkdir -p "$(dirname "$target_path")"

  if [[ -f "$target_path" ]]; then
    # Compare against a timestamp-stripped copy so a prior run that included
    # generated_at doesn't force an unnecessary overwrite.
    local normal_output="$TMP_DIR/output-normalized.json"
    cp "$target_path" "$normal_output"
    node --input-type=module - "$normal_output" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const p = process.argv[2];
const data = JSON.parse(readFileSync(p, 'utf8'));
delete data.generated_at;
writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
JS
    if cmp -s "$source_path" "$normal_output"; then
      echo "✅ $target_path is up to date."
    else
      cp "$source_path" "$target_path"
      echo "wrote generated file to $target_path"
    fi
  else
    cp "$source_path" "$target_path"
    echo "wrote generated file to $target_path"
  fi
}

if [[ -n "$OUTPUT_PATH" ]]; then
  write_output "$OUTPUT_PATH" "$TMP_INDEX"
fi

# When writing the default index (i.e. --update), also keep the schema in sync.
if [[ "$UPDATE" = 1 ]]; then
  write_output "$DEFAULT_SCHEMA_PATH" "$TMP_SCHEMA"
fi
