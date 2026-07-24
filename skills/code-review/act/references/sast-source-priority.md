# SAST Source Priority (the locally reproducible path)

The body of the `/act` skill points here from the P0b section. This is
the step-by-step for reading SAST findings, in priority order. Reach for
it whenever a required check fails from a SAST tool.

## Step 1: Read GitHub CI run annotations (primary source)

Use the project's own `pr-state.sh` to read the head SHA's check-runs
and surface `SAST_FINDINGS_PENDING`; for manual triage outside that
script, query the head SHA's check-runs directly. `gh pr checks
--json name,status,conclusion` does NOT return a check-run ID, so
the `<check-run-id>` below is the ID from the head SHA's
`check-runs` endpoint, not from `gh pr checks`.

```bash
# List check-runs for the PR's tip commit. Use --paginate because
# a large SAST run can produce many check-runs and the default
# page is small.
gh api repos/<owner>/<repo>/commits/<tip-sha>/check-runs \
  --paginate --jq '.check_runs[] | {id, name, conclusion}'

# Read annotations — this is the source of truth. Also paginate:
# the default annotations page is 30 entries and a single SAST run
# can have many more. The `--paginate` flag follows the Link headers
# until the last page, so every annotation is fetched.
gh api repos/<owner>/<repo>/check-runs/<check-run-id>/annotations \
  --paginate
```

Most tools (SonarCloud, Codacy, CodeScene, CodeQL, Semgrep, Trivy)
emit inline annotations via this API. **This is not an external
service you cannot access** — these annotations are on your PR, via
GitHub's own API, using `gh` which you already have.

## Step 2: Download SARIF if annotations are absent or insufficient

Some tools (CodeQL, Snyk, Trivy) also produce SARIF artifacts. Check
workflow artifacts:

```bash
gh api repos/<owner>/<repo>/actions/runs/<run-id>/artifacts
```

## Step 3: Check for CLI + env vars

If annotations and SARIF don't give enough detail, check if a local
CLI can reproduce:

| Tool | Check | Env var |
|------|-------|--------|
| Codacy | `which codacy-cli-v2` | `CODACY_API_TOKEN` |
| CodeScene | `which cs` | `CS_ACCESS_TOKEN` |
| SonarQube | `which sonar-scanner` | `SONAR_TOKEN` |
| Semgrep/Opengrep | `which opengrep` | (none — config in repo) |

## Step 4: Install and run locally (last resort)

See the relevant skill (`codacy`, `codescene`, etc.) for installation
instructions.

## Recognised SAST tools (in `pr-state.sh`)

`pr-state.sh` surfaces SAST load as `SAST_FINDINGS_PENDING=N` — count
of `annotation_level=failure` entries on **failing** SAST runs (zero
extra `gh` calls when CI is fully green).

| Tool | Annotation carrier | Why it's P0 |
|------|-------------------|-------------|
| SonarCloud / SonarQube | `repos/<o>/<r>/check-runs/<id>/annotations` | New `BLOCKER` / `CRITICAL` finding on changed code |
| Codacy | same | Linter finding raised as `failure` annotation |
| CodeScene | same | Complexity / code-health finding on changed code |
| CodeQL | same | Security query match on changed code |
| Opengrep / Semgrep | same | Security rule match on changed code |
| Trivy / Snyk / Skillspector / GitGuardian | same | CVE / secret / committed-anomaly finding |

**Reading annotations is non-negotiable for failed SAST runs.** A
failing Codacy "N new issues (0 max.)" gate with `annotations=0` on
the check-run is the common case the cloud app rarely annotates in
detail — in that scenario the agent must read the underlying linter
output, install the linter locally, and reproduce the issue (see the
Codacy skill). A failing SAST gate cannot be dismissed as "linter
noise" or "unclear" without the agent having read the annotations
first.

## Locally reproducible path

| Signal in `pr-state.sh` / `gh pr checks` | Reproduce locally |
|---|---|
| `Codacy Static Code Analysis` fail / action_required | Step 1: Read annotations via `gh api`. Step 2: If `annotations=0`, install linter per Codacy skill and run locally. |
| `Opengrep OSS` / `OpenGrep` fail | Step 1: Read annotations. Step 2: `opengrep --config .semgrep.yaml <changed-paths>` |
| `SonarCloud Code Analysis` fail | Step 1: Read annotations. Step 2: `sonar-scanner` (or read REVIEW.md for Sonar rules) |
| `CodeQL` fail | Step 1: Read annotations. Step 2: Download SARIF from workflow artifacts; re-run workflow job if needed |
| `CodeScene` fail | Step 1: Read annotations. Step 2: `cs delta origin/main HEAD` per the CodeScene skill |
| `Trivy` / `Snyk` fail | Step 1: Read annotations. Step 2: Download SARIF from artifacts; `trivy fs --format sarif .` or `snyk test` |

Codacy "N new issues (0 max.)" with `annotations=0` on the check-run
**always** means linter issues raised without inline annotations —
install the linter, run it, fix what it reports, push. Do not file
the issue as "unclear" without reproducing locally.
