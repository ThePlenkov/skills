#!/usr/bin/env bash
# Validate every agent manifest under .agents/agents/<agent>/manifest.yaml.
#
# For each agent directory under .agents/agents/:
#   * manifest.yaml must exist
#   * agent: field must match the directory name
#   * required / optional / forbidden skill names must all be unique
#     within the manifest and must exist in .agents/skills/ (the
#     installed flat-symlink view)
#
# Exits non-zero on any failure with a clear diagnostic.

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
AGENTS_DIR="${REPO_ROOT}/.agents/agents"
SKILLS_DIR="${REPO_ROOT}/.agents/skills"

if [[ ! -d "$AGENTS_DIR" ]]; then
  printf '%s\n' "agents directory not found: $AGENTS_DIR" >&2
  exit 1
fi

if [[ ! -d "$SKILLS_DIR" ]]; then
  printf '%s\n' "installed skills directory not found: $SKILLS_DIR" >&2
  exit 1
fi

FAILED=0

# Iterate every agent directory.
for agent_dir in "$AGENTS_DIR"/*/; do
  [[ -d "$agent_dir" ]] || continue
  agent_dir=${agent_dir%/}
  agent=$(basename "$agent_dir")
  manifest="${agent_dir}/manifest.yaml"
  agent_failed=0

  if [[ ! -f "$manifest" ]]; then
    printf '❌ %s: missing manifest.yaml\n' "$agent" >&2
    FAILED=1; agent_failed=1
    continue
  fi

  # Extract agent: field (first match) and verify it matches the directory name.
  agent_field=$(awk '
    /^agent:/ { sub(/^agent:[[:space:]]*/, ""); sub(/[[:space:]]*$/, ""); gsub(/^["'"'"']|["'"'"']$/, ""); print; exit }
  ' "$manifest")

  if [[ -z "$agent_field" ]]; then
    printf '❌ %s: manifest.yaml missing top-level agent: field\n' "$agent" >&2
    FAILED=1; agent_failed=1
    continue
  fi

  if [[ "$agent_field" != "$agent" ]]; then
    printf '❌ %s: manifest agent: "%s" does not match directory "%s"\n' \
      "$agent" "$agent_field" "$agent" >&2
    FAILED=1; agent_failed=1
  fi

  # Validate the manifest structure against the JSON schema using the
  # locally installed ajv-cli and yaml packages.
  SCHEMA="${REPO_ROOT}/.github/agent-manifest-schema.json"
  if [[ -f "$SCHEMA" ]]; then
    AJV="${REPO_ROOT}/node_modules/.bin/ajv"
    tmpjson=$(mktemp /tmp/agent-manifest-XXXXXX.json)
    ajv_out=$(mktemp /tmp/ajv-out-XXXXXX.txt)
    if ! node -e '
      const YAML = require("yaml");
      const fs = require("fs");
      const data = fs.readFileSync(process.argv[1], "utf8");
      try {
        process.stdout.write(JSON.stringify(YAML.parse(data)));
      } catch (e) {
        console.error("YAML parse error:", e.message);
        process.exit(1);
      }
    ' "$manifest" > "$tmpjson" 2>"$ajv_out"; then
      printf '❌ %s: failed to parse manifest as YAML\n' "$agent" >&2
      sed 's/^/  /' "$ajv_out" >&2
      FAILED=1; agent_failed=1
    elif ! "$AJV" validate -s "$SCHEMA" -d "$tmpjson" --spec=draft7 >"$ajv_out" 2>&1; then
      printf '❌ %s: manifest does not match %s\n' "$agent" ".github/agent-manifest-schema.json" >&2
      sed 's/^/  /' "$ajv_out" >&2
      FAILED=1; agent_failed=1
    fi
    rm -f "$tmpjson" "$ajv_out"
  fi

  # Parse each skill list. We read line by line; the YAML lists for
  # required / optional / forbidden use "- name" entries. We stop on
  # the next top-level key.
  declare -A seen_skills=()
  current_list=""
  list_label=""

  check_skill() {
    local skill="$1"
    if [[ -n "${seen_skills[$skill]:-}" ]]; then
      printf '❌ %s: skill "%s" appears more than once across required/optional/forbidden\n' \
        "$agent" "$skill" >&2
      FAILED=1; agent_failed=1
      return
    fi
    seen_skills[$skill]=1
    if [[ "$skill" == "$agent" ]]; then
      printf '❌ %s: skill "%s" in %s must not be the agent itself (prevents recursive self-delegation)\n' \
        "$agent" "$skill" "$list_label" >&2
      FAILED=1; agent_failed=1
      return
    fi
    if [[ ! -e "$SKILLS_DIR/$skill" ]]; then
      printf '❌ %s: unknown skill "%s" in %s (not found in %s)\n' \
        "$agent" "$skill" "$list_label" "${SKILLS_DIR#$REPO_ROOT/}" >&2
      FAILED=1; agent_failed=1
    fi
  }

  while IFS= read -r line; do
    # List keys (required / optional / forbidden) must be checked before
    # the generic top-level scalar pattern, otherwise the generic regex
    # matches them and resets the list context before we can record it.
    if [[ "$line" =~ ^(required|optional|forbidden):[[:space:]]*(#.*)?$ ]]; then
      current_list="${BASH_REMATCH[1]}"
      list_label="$current_list"
      continue
    fi
    # Top-level scalar/non-list keys reset the current list context.
    if [[ "$line" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*:[[:space:]]*([^[:space:]]|$) ]]; then
      current_list=""
      list_label=""
      continue
    fi
    if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*(.+)$ ]] && [[ -n "$current_list" ]]; then
      raw="${BASH_REMATCH[1]}"
      raw="${raw%%#*}"
      raw=$(printf '%s' "$raw" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^["'"'"']//; s/["'"'"']$//')
      if [[ -n "$raw" ]]; then
        check_skill "$raw"
      fi
    fi
  done < "$manifest"

  if [[ "$agent_failed" -eq 0 ]]; then
    printf '✅ %s manifest valid\n' "$agent"
  fi

  unset seen_skills
done

exit $FAILED
