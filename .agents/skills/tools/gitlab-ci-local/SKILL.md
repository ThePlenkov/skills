---
name: gitlab-ci-local
description: Test GitLab CI pipelines locally using gitlab-ci-local. Use when debugging CI jobs, validating pipeline changes, or running jobs without pushing to GitLab.
version: "1.0"
compatibility: Requires Node.js and Docker installed and running.
---

# GitLab CI Local Testing

Test GitLab CI pipelines locally using `gitlab-ci-local` without pushing to GitLab.

## Prerequisites

1. Install: `npm install -g gitlab-ci-local`
2. Docker must be installed and running

## Commands

### Run a specific job
```bash
gitlab-ci-local <job-name>
```

### Run with environment variables
```bash
gitlab-ci-local <job-name> -e VAR_NAME=value -e ANOTHER_VAR=value
```

### List available jobs
```bash
gitlab-ci-local --list
```

### Run ignoring dependencies (faster for testing single jobs)
```bash
gitlab-ci-local <job-name> --needs
```

## Tips

- **Artifacts**: Stored in `.gitlab-ci-local/artifacts`
- **Variables**: Pass all required secrets via `-e VAR=VAL`
- **Permissions**: If you see permission errors, ensure Docker socket is accessible
- **Speed**: Use `--needs` to skip dependency jobs when testing a single job
- **Debugging**: Add `--preview` to see the resolved YAML without running

## Troubleshooting

- **Docker not running**: Start Docker daemon first
- **Permission denied on socket**: Add user to `docker` group or use `sudo`
- **Missing variables**: Check required CI/CD variables with `--list` and pass them via `-e`
