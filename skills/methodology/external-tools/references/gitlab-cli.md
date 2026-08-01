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

## Environment prerequisite

Always set `GLAB_NO_PROMPT` before running any `glab` command in automation.

- POSIX: `export GLAB_NO_PROMPT=true`
- PowerShell: `$env:GLAB_NO_PROMPT = "true"`
- CMD: `set GLAB_NO_PROMPT=true`

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
2. If MCP/tools are unavailable, use `glab` with `GLAB_NO_PROMPT` set.
3. If `glab` is missing or insufficient, use the GitLab REST / GraphQL API directly (see [gitlab-api.md](gitlab-api.md)).

## Pipeline status checks

```bash
glab ci status
```

## Pipeline operations

```bash
glab ci run -b main
glab ci list
glab ci trigger <job-id>
glab ci lint
```

## CI/CD validation

Always lint CI/CD YAML before committing changes:

```bash
glab ci lint
```

## Repository management

```bash
glab project view
glab mr list
```

## Commands to avoid in automation

These commands are interactive even with `GLAB_NO_PROMPT=true`:

- `glab ci view` - opens interactive menu
- `glab ci view <branch>` - interactive

**Use `glab ci status` instead for pipeline information.**

## Automation rule

**Rule**: Every `glab` command must be run with `GLAB_NO_PROMPT` set.

**Critical**: Always run `glab ci lint` before committing any changes to `.gitlab-ci.yml`.

## CI/CD development workflow

1. Make changes to `.gitlab-ci.yml`.
2. **Always lint**: `glab ci lint`.
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
git add .gitlab-ci.yml
git commit -m "Update CI"
```

Correct (proper workflow):

```bash
# Edit .gitlab-ci.yml
glab ci lint
git add .gitlab-ci.yml
git commit -m "Update CI"
```
