---
name: glab
description: GitLab CLI automation with non-interactive mode. Automatically sets GLAB_NO_PROMPT=true to prevent hanging on interactive prompts.
metadata:
  tier: 2
  triggers:
    - user
    - model
  source: theplenkov-ai/skills
---

# GitLab CLI (glab) Automation

**Always use this skill when running any `glab` command to prevent interactive prompts.**

## Problem Solved

The `glab ci status` command (and other glab commands) show interactive menus that hang automation:

```
Choose an action:
> View logs
  Retry
  Exit
```

This skill ensures `GLAB_NO_PROMPT=true` is set for all glab commands.

## Implementation

When you use this skill, always prepend `GLAB_NO_PROMPT=true` to glab commands:

### Pipeline Status Checks

```bash
GLAB_NO_PROMPT=true glab ci status
```

### Pipeline Operations  

```bash
GLAB_NO_PROMPT=true glab ci run -b main
GLAB_NO_PROMPT=true glab ci list
GLAB_NO_PROMPT=true glab ci trigger <job-id>
GLAB_NO_PROMPT=true glab ci lint
```

### CI/CD Validation

```bash
# Always lint CI/CD YAML before committing changes
GLAB_NO_PROMPT=true glab ci lint
```

### Repository Management

```bash
GLAB_NO_PROMPT=true glab project view
GLAB_NO_PROMPT=true glab mr list
```

## Commands to Avoid in Automation

These commands are interactive even with `GLAB_NO_PROMPT=true`:

- `glab ci view` - opens interactive menu
- `glab ci view <branch>` - interactive

**Use `glab ci status` instead for pipeline information.**

## Automation Rule

**Rule**: Every `glab` command must be prefixed with `GLAB_NO_PROMPT=true`

**CRITICAL**: Always run `GLAB_NO_PROMPT=true glab ci lint` before committing any changes to `.gitlab-ci.yml`

## CI/CD Development Workflow

1. Make changes to `.gitlab-ci.yml`
2. **ALWAYS lint**: `GLAB_NO_PROMPT=true glab ci lint`
3. If lint passes, commit and push
4. If lint fails, fix errors and repeat

## Examples

❌ **Wrong** (hangs on interactive menu):

```bash
glab ci status --branch main
```

❌ **Wrong** (misses linting):

```bash
# Edit .gitlab-ci.yml
git add .gitlab-ci.yml && git commit -m "Update CI"
```

✅ **Correct** (proper workflow):

```bash
# Edit .gitlab-ci.yml
GLAB_NO_PROMPT=true glab ci lint
git add .gitlab-ci.yml && git commit -m "Update CI"
```
