---
name: codacy
description: >-
  Codacy static analysis — reproduce findings locally, debug "N issues (0 max.)"
  failures, work with Codacy CLI, GitHub annotations API, and org-level secrets.
---

# Codacy

Use when working with Codacy static code analysis, reproducing Codacy issues locally, or using the Codacy CLI.

## When to use

- Codacy check fails with "N new issues (0 max.)" and no annotations
- Need to reproduce Codacy findings locally
- Investigating Codacy ErrorProne, ShellCheck, or other linter issues
- Setting up Codacy CLI for local analysis

## Key patterns

### Token-rational Codacy workflow (PRIORITY)

**Always read annotations first via GitHub API:**

```bash
# Get the latest Codacy check run ID for the PR
gh pr checks <pr-number> --json name,headSha

# Read the actual Codacy annotations
gh api repos/<owner>/<repo>/check-runs/<check-run-id>/annotations
```

**Why:** GitHub API is instant and shows exactly what Codacy flagged. Do not assume "ErrorProne" means Java - read the actual annotations to identify the real tool/language.

**Workflow:**
1. **First:** Read Codacy annotations via GitHub API
2. **Then:** Identify the actual tool/language from annotations
3. **Finally:** Run local linter or fix code based on actual findings

**Docker asset as backup:** Use Docker setup only when native linter reproduction fails, not as first step.

### Codacy "N issues (0 annotations)" pattern

When Codacy reports `N new issues (0 max.)` with `annotations=0`:

1. **Identify the linter** - Check the Codacy check output for the tool name (e.g., ShellCheck, ErrorProne, Opengrep)
2. **Install the linter locally**
3. **Run the linter** on the changed files
4. **Fix the issues**
5. **Commit and push** the fixes

**Common linters:**
- **ShellCheck:** `shellcheck <file.sh>`
- **Opengrep:** `opengrep --config .semgrep.yaml --sarif-output=opengrep.sarif .`
- **ErrorProne:** Java static analysis (requires Java build)
- **Bandit:** Python security (for Python files)

### CI/CD integration

**Codacy stays on the Codacy cloud app (not in CI)** - see `.github/workflows/ci.yml` line 2.

Codacy runs automatically on the repository as a separate cloud service. It is not part of the GitHub Actions CI workflow.

### Codacy CLI v2

**Docker Asset:** Use the Docker image for local reproduction when native installation fails.

```bash
# Build the Docker image with Java pre-installed
docker build -f .agents/skills/codacy/assets/Dockerfile -t codacy-java:latest .

# Run PMD analysis (Java static analysis similar to ErrorProne)
docker run --rm -v ${PWD}:/project -w /project codacy-java:latest bash -c \
  "curl -L https://github.com/pmd/pmd/releases/download/pmd_releases%2F7.11.0/pmd-dist-7.11.0-bin.zip -o /project/tmp/pmd.zip && \
  unzip -q /project/tmp/pmd.zip -d /project/tmp && \
  /project/tmp/pmd-bin-7.11.0/bin/pmd check -d /project/apps/openadt-sap-adt/src/main/java \
  -R /project/.codacy/tools-configs/ruleset.xml -f sarif -r /project/tmp/pmd-results.sarif --no-fail-on-violation && \
  cat /project/tmp/pmd-results.sarif"
```

**Native Installation:**

Linux/macOS:
```bash
brew install codacy/codacy-cli-v2/codacy-cli-v2
# or
bash <(curl -Ls https://raw.githubusercontent.com/codacy/codacy-cli-v2/main/codacy-cli.sh)
```

**Windows:** Requires WSL (native Windows not supported). Use WSL terminal with the Linux installation command.

**Usage:**
```bash
# Local mode (uses local config files)
codacy-cli init
codacy-cli analyze

# Remote mode (fetch config from Codacy)
codacy-cli init --api-token <token> --provider gh --organization <org> --repository <repo>
codacy-cli analyze
```

### Codacy API

**Requires:** `CODACY_API_TOKEN` environment variable

**Get PR issues:**
```bash
gh api repos/abapify/openadt/pulls/92/comments
```

**Note:** Codacy cloud UI requires JavaScript and may not be accessible via simple API calls.

### Domain context

**Codacy false positives:** See `.codacy/instructions/review.md`

**Intentional patterns (do NOT flag):**
- Loopback bind (`127.0.0.1`, SSO callback, hub TLS probe) - not SSRF
- TOML config keys like `http_truststore_password` - not credentials
- Java constants like `KEY_HTTP_TRUSTSTORE_PASSWORD` - not secrets

**Line-specific suppressions:** Use `// nosemgrep: <rule-id>` for Semgrep/Opengrep. Do not exclude whole production files.

## Common scenarios

### Scenario: ShellCheck issues on shell scripts

**Symptom:** Codacy reports ShellCheck issues on `.sh` files

**Fix:**
```bash
# Install ShellCheck
# macOS: brew install shellcheck
# Linux: apt-get install shellcheck
# Windows: scoop install shellcheck

# Run on the file
shellcheck scripts/your-script.sh

# Fix the issues and push
```

### Scenario: ErrorProne issues on Java code

**Symptom:** Codacy reports ErrorProne (Java static analysis) issues

**Fix:**
```bash
# ErrorProne runs as part of Java compilation
# Reproduce by running Maven/Gradle with ErrorProne enabled

# For this repo (Maven):
./mvnw compile -Perrorprone

# Or check if issues are pre-existing (not caused by your changes)
# ErrorProne is a Java tool - if your PR only adds Python/YAML, issues are likely pre-existing
```

### Scenario: Opengrep/Semgrep issues

**Symptom:** Codacy reports Opengrep (Semgrep) issues

**Fix:**
```bash
# Install OpenGrep
curl -fsSL -o opengrep https://github.com/opengrep/opengrep/releases/download/v1.22.0/opengrep_manylinux_x86
chmod +x opengrep

# Run with repo config
./opengrep scan --config .semgrep.yaml --sarif-output=opengrep.sarif .

# Check results
cat opengrep.sarif

# Fix issues or add line-specific suppressions
# Use: // nosemgrep: <rule-id>
```

## Memory reminder template

When encountering new Codacy patterns, add to `.memory/experience/`:

```markdown
---
date: YYYY-MM-DD
context: https://github.com/abapify/openadt/pull/NNN
tags: [codacy, <linter-name>, ci]
---

## What went wrong
[Brief description of the issue]

## Why
[Root cause analysis]

## Proposed fix
[How to fix or prevent]

## Scope
[universal | project-specific | user-specific]
```

## References

- Codacy CLI v2: https://github.com/codacy/codacy-cli-v2
- Codacy instructions: `.codacy/instructions/review.md`
- Codacy guardrails: `.codacy/guardrails.yaml`
- Semgrep config: `.semgrep.yaml`
- Act skill Codacy handling: `.agents/skills/act/SKILL.md`
