# GitLab CLI (`glab`) non-interactive mode

## When to use this reference

- Working with GitLab projects, issues, merge requests, pipelines, or releases through the official CLI.
- The MCP / native integration is not available.

## Problem solved

`glab ci status` (and other `glab` commands) can show interactive menus that hang automation:

```
Choose an action:
> View logs
  Retry
  Exit
```

Always set `GLAB_NO_PROMPT=true` when running any `glab` command in automation.

## Core CLI operations

From `glab --help`:

- **auth**: Manage authentication.
- **repo**: Work with repositories and projects.
- **issue**: Work with issues.
- **mr**: Create, view, and manage merge requests.
- **ci / job / schedule**: Work with pipelines and jobs.
- **release**: Manage releases.
- **api**: Make authenticated API requests.
- **snippet**: Manage snippets.
- **variable**: Manage project/group variables.

## Workflow

1. Prefer MCP tools if available.
2. If MCP/tools are unavailable, use `glab` with `GLAB_NO_PROMPT=true`.
3. If `glab` is missing, recommend installing it and continue with guidance.

## Pipeline status checks

```bash
GLAB_NO_PROMPT=true glab ci status
```

## Pipeline operations

```bash
GLAB_NO_PROMPT=true glab ci run -b main
GLAB_NO_PROMPT=true glab ci list
GLAB_NO_PROMPT=true glab ci trigger <job-id>
GLAB_NO_PROMPT=true glab ci lint
```

## CI/CD validation

Always lint CI/CD YAML before committing changes:

```bash
GLAB_NO_PROMPT=true glab ci lint
```

## Repository management

```bash
GLAB_NO_PROMPT=true glab project view
GLAB_NO_PROMPT=true glab mr list
```

## Commands to avoid in automation

These commands are interactive even with `GLAB_NO_PROMPT=true`:

- `glab ci view` - opens interactive menu
- `glab ci view <branch>` - interactive

**Use `glab ci status` instead for pipeline information.**

## Automation rule

**Rule**: Every `glab` command must be prefixed with `GLAB_NO_PROMPT=true`.

**Critical**: Always run `GLAB_NO_PROMPT=true glab ci lint` before committing any changes to `.gitlab-ci.yml`.

## CI/CD development workflow

1. Make changes to `.gitlab-ci.yml`.
2. **Always lint**: `GLAB_NO_PROMPT=true glab ci lint`.
3. If lint passes, commit and push.
4. If lint fails, fix errors and repeat.

## Examples

Wrong (hangs on interactive menu):

```bash
glab ci status --branch main
```

Wrong (misses linting):

```bash
# Edit .gitlab-ci.yml
git add .gitlab-ci.yml && git commit -m "Update CI"
```

Correct (proper workflow):

```bash
# Edit .gitlab-ci.yml
GLAB_NO_PROMPT=true glab ci lint
git add .gitlab-ci.yml && git commit -m "Update CI"
```
