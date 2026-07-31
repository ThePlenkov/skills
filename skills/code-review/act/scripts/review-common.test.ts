import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "review-common.sh");

function runBash(code: string): { stdout: string; stderr: string; exitCode: number } {
	const dir = mkdtempSync(join(tmpdir(), "review-common-"));
	const file = join(dir, "test.sh");
	writeFileSync(file, code);
	const proc = Bun.spawnSync(["bash", file]);
	return {
		stdout: proc.stdout.toString(),
		stderr: proc.stderr.toString(),
		exitCode: proc.exitCode,
	};
}

describe("review-common.sh", () => {
	test("review_gitlab_graphql encodes -F booleans and keeps -f strings", () => {
		const code = `
set -euo pipefail
export GITLAB_TOKEN=fake
export ACT_PROVIDER=gitlab
curl() {
  local next_d=0
  for arg in "$@"; do
    if [[ "$next_d" -eq 1 ]]; then
      echo "$arg"
      next_d=0
    fi
    [[ "$arg" == "-d" ]] && next_d=1
  done
  return 0
}
source "${SCRIPT}"
payload=$(review_gitlab_graphql -f query="query{project}" -F p="group/project" -f i="42" -F d=true)
jq -e '(.variables.d | type) == "boolean"' <<<"$payload" >/dev/null
jq -e '.variables.d == true' <<<"$payload" >/dev/null
jq -e '(.variables.i | type) == "string"' <<<"$payload" >/dev/null
jq -e '(.variables.p | type) == "string"' <<<"$payload" >/dev/null
jq -e '.variables.p == "group/project"' <<<"$payload" >/dev/null
payload2=$(review_gitlab_graphql -f query="query{project}" -F flag=false -F n=123)
jq -e '(.variables.flag | type) == "boolean"' <<<"$payload2" >/dev/null
jq -e '(.variables.n | type) == "number"' <<<"$payload2" >/dev/null
`;
		const result = runBash(code);
		expect(result.exitCode).toBe(0);
	});

	test("review_detect_provider does not leak credentials in errors", () => {
		const code = `
set -euo pipefail
repo=$(mktemp -d)
cd "$repo"
git init -q
git remote add origin "https://supersecrettoken@gitlab.example.com/group/project.git"
source "${SCRIPT}"
review_detect_provider
[[ "$REVIEW_PROVIDER" == "gitlab" ]] || { echo "expected gitlab, got $REVIEW_PROVIDER"; exit 1; }
[[ "$REVIEW_HOST" == "gitlab.example.com" ]] || { echo "expected host stripped, got $REVIEW_HOST"; exit 1; }
git remote set-url origin "not-a-url-with-supersecrettoken"
if review_detect_provider 2>&1 | grep -q "supersecrettoken"; then
  echo "error: leaked token in provider error" >&2
  exit 1
fi
`;
		const result = runBash(code);
		expect(result.exitCode).toBe(0);
		expect(result.stderr).not.toContain("supersecrettoken");
	});

	test("review_resolve_target falls back to open PR for current branch on GitHub", () => {
		const code = `
set -euo pipefail
repo=$(mktemp -d)
cd "$repo"
git init -q
git checkout -q -b feat/test
git remote add origin "https://github.com/owner/repo.git"
# Fake gh to avoid network/auth requirements.
gh() {
  if [[ "$1" == "auth" ]]; then
    echo "not authenticated" >&2
    return 1
  fi
  if [[ "$1 $2" == "pr list" ]]; then
    echo '{"number":7}'
    return 0
  fi
  return 1
}
export -f gh
source "${SCRIPT}"
review_resolve_target
[[ "$REVIEW_OWNER" == "owner" ]] || { echo "expected owner, got $REVIEW_OWNER"; exit 1; }
[[ "$REVIEW_REPO" == "repo" ]] || { echo "expected repo, got $REVIEW_REPO"; exit 1; }
[[ "$REVIEW_NUMBER" == "7" ]] || { echo "expected 7, got $REVIEW_NUMBER"; exit 1; }
`;
		const result = runBash(code);
		expect(result.exitCode).toBe(0);
	});
});
