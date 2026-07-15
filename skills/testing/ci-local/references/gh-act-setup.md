# gh-act Installation and Configuration

Install and configure `gh-act` (nektos/act) for local GitHub Actions execution. Reference only — invoke from `ci-local`.

## Recommended: GitHub CLI extension

```bash
gh extension install nektos/gh-act
```

## Alternative install methods

```bash
# macOS
brew install act

# Windows (Chocolatey)
choco install act-cli

# Linux (review script first: https://github.com/nektos/act/blob/master/install.sh)
curl -fsSL https://raw.githubusercontent.com/nektos/act/master/install.sh -o "${TMPDIR:-/tmp}/act-install.sh" && bash "${TMPDIR:-/tmp}/act-install.sh" -b ~/.local/bin

# Manual: download from https://github.com/nektos/act/releases
```

## Non-interactive configuration (.actrc)

Create `.actrc` in project root:

```
-P ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest
```

## Image options

| Image | Size | Use when |
|-------|------|----------|
| **Micro** (`node:16-buster-slim`) | ~200 MB | NodeJS only, limited compatibility |
| **Medium** (`ghcr.io/catthehacker/ubuntu:act-latest`) | ~500 MB | Recommended. Most compatible. |
| **Large** (`ghcr.io/catthehacker/ubuntu:full-latest`) | ~18 GB | Full GitHub runner snapshot |

## Requirements

- Docker installed and running.
- Sufficient disk space for runner images (500 MB – 18 GB).
- First run downloads selected image.

## Command reference

```bash
gh act --list                  # list available jobs
gh act                        # run all workflows
gh act -W .github/workflows/ci.yml
gh act -j lint                # one job
gh act -j shellcheck -j markdownlint
gh act --dryrun               # preview without running
gh act --secret-file .secrets
gh act push                   # simulate push event
gh act pull_request           # simulate PR event
```

Always use `--dryrun` first to verify what will execute.
