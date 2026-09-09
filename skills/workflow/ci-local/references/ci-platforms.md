# CI Platform Detection and Parsing

Detection and parsing helpers for non-GitHub-Actions CI platforms. Use when `act` is unavailable and you need to run checks locally.

## Detection commands

Use your search tools or a Node/Python script to detect CI config files:

- **GitHub Actions**: look for `.github/workflows/*.yml` and `*.yaml`
- **GitLab CI**: check for `.gitlab-ci.yml`
- **Azure Pipelines**: look for `azure-pipelines.yml` or `azure-pipelines.yaml`
- **CircleCI**: check for `.circleci/config.yml`
- **Jenkins**: check for `Jenkinsfile`

## GitHub Actions fallback parsing

If `act` is not available, parse `.github/workflows/*.yml`:

- Extract `jobs.<job-id>.steps[].run` commands
- Detect `actions/setup-*` for environment setup
- Identify validation jobs (lint, test, build)

## GitLab CI

Parse `.gitlab-ci.yml`:

- Extract `<job>.script` commands
- Detect `before_script` for setup
- Identify validation stages

## Azure Pipelines

Parse `azure-pipelines.yml`:

- Extract `steps[].script` or `steps[].task` commands
- Detect setup steps
- Identify validation tasks

## CircleCI

Parse `.circleci/config.yml`:

- Extract `jobs.<job>.steps[].run` commands
- Detect setup steps
- Identify validation jobs

## Jenkins

Parse `Jenkinsfile`:

- Extract `sh` or `bat` commands from stages
- Detect setup steps
- Identify validation stages

## Check categorization

Group detected checks into:

- **Linting**: ESLint, Prettier, Stylelint, markdown lint, YAML/JSON validation, shellcheck
- **Type checking**: `tsc --noEmit`, Flow, MyPy
- **Testing**: unit / integration / e2e
- **Building**: compilation, bundling, asset generation
- **Security**: dependency scanning, secret scanning, SAST
- **Other**: license checks, documentation generation, coverage reports

## Runnability filter

Runnable locally (default): lint, type check, unit tests, build.

Skip: deployment, external services, cloud-specific steps, anything requiring secrets/credentials.
