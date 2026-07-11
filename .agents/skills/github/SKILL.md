---
name: github
description: Work with GitHub repositories, issues, pull requests, releases, and Actions. Use when interacting with GitHub or GitHub MCP tools, or when you need a CLI fallback.
---

# GitHub

## Overview

Use MCP tools when available. If MCP/tools are unavailable, use the `gh` CLI. If `gh` is missing, recommend installing it.

## Core CLI Operations (gh)

From `gh --help`:

- **auth**: Authenticate gh and git with GitHub.
- **repo**: Manage repositories.
- **issue**: Manage issues.
- **pr**: Manage pull requests.
- **release**: Manage releases.
- **workflow / run / cache**: Work with GitHub Actions.
- **api**: Make authenticated API requests.
- **search**: Search repos, issues, and PRs.

## Workflow

1. Prefer MCP tools if available.
2. If MCP/tools are unavailable, use `gh` for the task.
3. If `gh` is missing, recommend installing it and continue with guidance.

## Notes

- Validate decisions and data against live sources where possible.

## Private repositories & secret-backed auth

Many personal / org repos are **private**. Anonymous `git clone` or unauthenticated
REST calls return **404** even for repos that exist — never conclude "the repo
doesn't exist" from a 404. Always retry with credentials first.

### Token resolution order

1. **`gh` CLI** — if installed and already authenticated (`gh auth status`),
   prefer `gh` for everything. It inherits the token automatically and handles
   the `x-access-token` URL form for `git clone`.
2. **Secret store** — for `curl` / raw API / environments without `gh`, read the
   `GH_TOKEN` (or repo-scoped) PAT from the platform secret store. Reference it
   as `${GH_TOKEN}` — never paste the value into code, commits, or chat output.
3. **Environment variable** — when scripting, `export GH_TOKEN="${GH_TOKEN}"`
   from the secret store, or `gh auth login --with-token <<<"$GH_TOKEN"` once
   per shell.

### Authenticated curl pattern

```bash
# Read-only REST
curl -sSL -H "Authorization: token ${GH_TOKEN}" \
  https://api.github.com/repos/<owner>/<repo>/contents/<path>

# git clone (HTTPS + token in URL — safe for short-lived shells, not for logs)
git clone https://x-access-token:${GH_TOKEN}@github.com/<owner>/<repo>.git
```

### git push / fetch with token

```bash
# One-shot, scoped to this command — prefer this
git -c "http.extraHeader=Authorization: token ${GH_TOKEN}" \
    push https://github.com/<owner>/<repo>.git <ref>

# Persistent remote with token (less safe — visible in `.git/config`)
git remote set-url origin \
  https://x-access-token:${GH_TOKEN}@github.com/<owner>/<repo>.git
```

### Red flags — stop and re-check the token

| Symptom | Likely cause |
|---|---|
| 404 on a known private repo | No / wrong token — retry with `${GH_TOKEN}` |
| 401 Bad credentials | Token expired or revoked — rotate via the secret store |
| 403 with `Resource not accessible by integration` | Token lacks the scope (need `repo` for private code) |
| 403 rate limit | Authenticated quota is 5 000/h; wait or use a different token |

### Security rules

- **Never** commit a token, paste it in a file under `.git/`, or echo it in
  logs. Use `${GH_TOKEN}` everywhere.
- **Never** store a token in agent memory (MEMORY.md) — secrets belong in the
  secret store only. Memory is injected into every prompt and would leak it.
- Prefer **fine-grained PATs** scoped to the smallest set of repos and
  permissions needed. Org-owned tokens should be read-only unless write access
  is required.
