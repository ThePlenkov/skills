#!/usr/bin/env bash
# Validate that every skill has an agents/openai.yaml file and that it
# conforms to .github/openai-metadata-schema.json.
set -euo pipefail

# shellcheck source=scan-skills.sh
source "$(dirname "$0")/scan-skills.sh"

REPO_ROOT=$(cd "$SCAN_SOURCE_DIR/.." && pwd -P)
SCHEMA="${REPO_ROOT}/.github/openai-metadata-schema.json"
FAILED=0

tmpjson=$(mktemp /tmp/openai-XXXXXX.json)
tmpout=$(mktemp /tmp/openai-ajv-XXXXXX.out)
trap 'rm -f "$tmpjson" "$tmpout"' EXIT

for skill_dir in "${SKILL_DIRS[@]}"; do
  rel=${skill_dir#"${SCAN_SOURCE_DIR}/"}
  openai_yaml="${skill_dir}/agents/openai.yaml"

  if [[ ! -f "$openai_yaml" ]]; then
    echo "::error file=${skill_dir}/SKILL.md,title=missing-openai-metadata::${rel} is missing agents/openai.yaml"
    FAILED=1
    continue
  fi

  if ! node -e '
    const YAML = require("yaml");
    const fs = require("fs");
    const text = fs.readFileSync(process.argv[1], "utf8").replace(/\r\n/g, "\n");
    const data = YAML.parse(text);
    fs.writeFileSync(process.argv[2], JSON.stringify(data));
  ' "$openai_yaml" "$tmpjson"; then
    echo "::error file=${openai_yaml},title=yaml-parse::Failed to parse agents/openai.yaml"
    FAILED=1
    continue
  fi

  if "${REPO_ROOT}/node_modules/.bin/ajv" validate -s "$SCHEMA" -d "$tmpjson" --spec=draft7 > "$tmpout" 2>&1; then
    echo "✅ ${rel}"
  else
    echo "❌ ${rel} — agents/openai.yaml validation failed"
    # ajv prints the temp JSON path as the failing file; replace it with the
    # source YAML path so annotations point at the right file.
    sed "s#${tmpjson}#${openai_yaml}#g" "$tmpout" | \
      CURRENT_FILE="$openai_yaml" \
      "${REPO_ROOT}/.github/scripts/to-annotations.sh" ajv
    FAILED=1
  fi
done

if [[ "$FAILED" = 1 ]]; then
  echo "❌ One or more skills have invalid OpenAI metadata." >&2
  exit 1
fi

echo "✅ All skills have valid OpenAI metadata."
exit 0
