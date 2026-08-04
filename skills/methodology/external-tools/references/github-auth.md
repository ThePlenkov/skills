# GitHub CLI (`gh`) and API auth

## When to use this reference

- Working with GitHub repositories, issues, pull requests, releases, or Actions.
- The MCP / native integration is not available.

## Core operations

From `gh --help`:

- **auth**: Authenticate `gh` and git with GitHub.
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

## Token resolution order

1. **`gh` CLI** — if installed and already authenticated (`gh auth status`), prefer `gh` for everything. It inherits the token automatically and handles the `x-access-token` URL form for `git clone`.
2. **Secret store** — for `curl` / raw API / environments without `gh`, read `GH_TOKEN` (or repo-scoped PAT) from the platform secret store. Reference it as `${GH_TOKEN}` — never paste the value into code, commits, or chat output.
3. **Environment variable** — when scripting, make `GH_TOKEN` available to the shell once:

   - POSIX: `export GH_TOKEN="${GH_TOKEN}"` then `printf '%s\n' "${GH_TOKEN}" | gh auth login --with-token`
   - PowerShell: `$env:GH_TOKEN = $GH_TOKEN` then `gh auth login --with-token`
   - CMD: `set GH_TOKEN=%GH_TOKEN%` then `gh auth login --with-token`

   The Bash examples below assume a POSIX shell. On Windows, run them in Git Bash or WSL, or use the equivalent PowerShell/CMD forms above.

## Authenticated API pattern

Prefer `gh api` for read-only REST calls. It reuses the active `gh` token and never exposes it on the command line.

```bash
gh api repos/<owner>/<repo>/contents/<path>
```

If you must use `curl` (e.g., a non-GitHub host or a container without `gh`), keep the token out of process arguments by using a `--netrc-file` created outside this command, and make HTTP failures exit non-zero:

```bash
# Ensure tmp/ exists and tmp/github.netrc contains the token (create it with your platform's file tools)
status=$(curl -sSL --netrc-file tmp/github.netrc -w '%{response_code}' \
  --connect-timeout 10 --max-time 30 \
  -H "Accept: application/vnd.github+json" \
  --create-dirs -o tmp/response.json \
  "https://api.github.com/repos/<owner>/<repo>/contents/<path>")
case "$status" in
  2[0-9][0-9]) ;;
  *) printf 'HTTP %s\n' "$status" >&2; exit 1 ;;
esac
```

## git authentication

Keep remotes credential-free. Let `gh` or a credential helper supply the token.

```bash
# Set up git to use the gh credential helper first
gh auth setup-git

# Clone or add a remote without embedding credentials
git clone https://github.com/<owner>/<repo>.git

# Update the remote from inside the cloned repository
git -C <repo> remote set-url origin https://github.com/<owner>/<repo>.git
```

If `gh` is not available, use Git Credential Manager or a secret-backed `GIT_ASKPASS` script. Never pass the token in a remote URL or via `http.extraHeader` on the command line.

## Red flags — stop and re-check the token

| Symptom | Likely cause |
|---|---|
| 404 on a known private repo | No / wrong token — retry with `${GH_TOKEN}` |
| 401 Bad credentials | Token expired or revoked — rotate via the secret store |
| 403 with `Resource not accessible by integration` | Token lacks the scope (need `repo` for private code) |
| 403 rate limit | If `retry-after` is present, wait that many seconds. If `x-ratelimit-remaining` is `0`, wait until `x-ratelimit-reset`. Use exponential backoff for secondary limits. |

## PAT permissions

- **Fine-grained PATs**
  - Read private content: `Contents: read`
  - Push code / create branches: `Contents: read/write`
  - Modify workflows: also `Workflows: read/write`
- **Classic PATs**
  - Use `repo` for full private repository access.
- **GitHub Apps**
  - Need the equivalent repository permissions granted by the app installation, not a PAT scope.

## Security rules

- **Never** commit a token, paste it in a file under `.git/`, or echo it in logs.
- **Never** expand a secret on the command line (e.g., `curl -H "Authorization: token ${GH_TOKEN}"`). Prefer `gh api`, or load the token from a credential file / netrc.
- Reference secrets through environment variables or your platform secret store; never paste the literal value into code, commits, or chat output.
- **Never** store a token in agent memory (`MEMORY.md`) — secrets belong in the secret store only. Memory is injected into every prompt and would leak it.
- Prefer **fine-grained PATs** scoped to the smallest set of repos and permissions needed. Org-owned tokens should be read-only unless write access is required.

## Private repositories

Many personal / org repos are **private**. Anonymous `git clone` or unauthenticated REST calls return **404** even for repos that exist — never conclude "the repo doesn't exist" from a 404. Always retry with credentials first.
