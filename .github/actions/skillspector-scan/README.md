# SkillSpector Scan Action

Portable GitHub Action that scans AI agent skills with [NVIDIA SkillSpector](https://github.com/NVIDIA/SkillSpector).

## Quick start

```yaml
name: SkillSpector

on:
  push:
    branches: [main]
    paths: ['skills/**']
  pull_request:
    paths: ['skills/**']
  workflow_dispatch:

permissions:
  contents: read
  security-events: write  # required for SARIF upload

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # required for changed-only detection
      - uses: ThePlenkov/skills/.github/actions/skillspector-scan@main
        with:
          path: ./skills
          changed-only: true
          upload-sarif: true
```

## How it works

1. Discovers all `SKILL.md` files under `path` (or just changed ones on PRs)
2. Runs `skillspector scan` on each skill directory
3. Merges JSON + SARIF reports into single files
4. Uploads SARIF to GitHub Code Scanning (findings appear in Security tab)
5. Writes step summary with findings table
6. Fails CI if `fail-on` or `min-score` threshold is exceeded

## Why not the community action?

| Feature | This action | NPJigaK/skillspector-action | theplenkov-ai custom |
|---|---|---|---|
| Runtime | pip (no Docker) | Docker image | pip + Nx |
| Dependencies | Python only | Docker + Python | Node + Nx + Python |
| SARIF merge | Python (readable) | Python | Node inline (unreadable) |
| Step summary | Yes | Yes | Yes (separate script) |
| Portability | Any repo | Any repo | Host repo only |
| SkillSpector version | Configurable (default v2.11.0) | Pinned to old commit | Pinned to old commit |
| Cache | pip cache | Docker layer | Nx cache |

## Inputs

| Input | Default | Description |
|---|---|---|
| `path` | `.` | Directory or SKILL.md to scan |
| `changed-only` | `false` | Scan only changed skills on PRs |
| `fail-on` | `none` | `none`, `high`, or `critical` |
| `min-score` | (empty) | Numeric risk score threshold (0-100) |
| `baseline` | (empty) | SkillSpector baseline file path |
| `upload-sarif` | `true` | Upload SARIF to GitHub Code Scanning |
| `sarif-category` | `skillspector` | SARIF category label |
| `llm` | `false` | Enable LLM semantic analysis |
| `exclude` | (empty) | Newline/comma-separated glob patterns |
| `skillspector-version` | `v2.11.0` | SkillSpector tag, SHA, or `latest` |
| `artifact-name` | `skillspector-reports` | Artifact name (empty = no artifact) |

## Outputs

| Output | Description |
|---|---|
| `sarif` | Path to merged SARIF report |
| `json` | Path to merged JSON report |
| `markdown` | Path to Markdown summary |
| `risk-score` | Highest risk score (0-100) |
| `risk-severity` | Highest risk severity |
| `findings-count` | Active findings after suppression |
| `scanned-count` | Number of skills scanned |

## Security notes

- Use `pull_request`, not `pull_request_target`, for untrusted PRs
- `llm` defaults to `false` — don't pass API keys to fork PR workflows
- Pin to a full commit SHA for production use: `@a1b2c3d...`

## License

Apache License 2.0
