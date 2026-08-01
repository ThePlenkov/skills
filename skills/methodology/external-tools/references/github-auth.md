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

## Authenticated curl pattern

Use `--fail-with-body` (curl 7.76.0+) so HTTP errors return a non-zero exit code while still preserving the response body. Add `--connect-timeout` and `--max-time` so hangs do not run forever.

```bash
# Read-only REST
curl -sSL --fail-with-body --connect-timeout 10 --max-time 30 \
  -H "Authorization: token ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/<owner>/<repo>/contents/<path>"
```

For older curl versions, drop `--fail-with-body` and check `%{response_code}` instead:

```bash
curl -sSL -w '\n%{response_code}\n' --connect-timeout 10 --max-time 30 \
  -H "Authorization: token ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -o /tmp/response.json \
  "https://api.github.com/repos/<owner>/<repo>/contents/<path>"
```

## git authentication

Keep remotes credential-free. Let `gh` or a credential helper supply the token.

```bash
# Clone or add a remote without credentials
git clone https://github.com/<owner>/<repo>.git
git remote set-url origin https://github.com/<owner>/<repo>.git

# Ensure git operations use the authenticated gh credential helper
gh auth setup-git
```

If `gh` is not available, use Git Credential Manager or a secret-backed `GIT_ASKPASS` script. Never pass the token in a remote URL or via `http.extraHeader` on the command line.

## Red flags — stop and re-check the token

| Symptom | Likely cause |
|---|---|
| 404 on a known private repo | No / wrong token — retry with `${GH_TOKEN}` |
| 401 Bad credentials | Token expired or revoked — rotate via the secret store |
| 403 with `Resource not accessible by integration` | Token lacks the scope (need `repo` for private code) |
| 403 rate limit | Authenticated quota is 5 000/h; wait or use a different token |

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

- **Never** commit a token, paste it in a file under `.git/`, or echo it in logs. Use `${GH_TOKEN}` everywhere.
- **Never** store a token in agent memory (`MEMORY.md`) — secrets belong in the secret store only. Memory is injected into every prompt and would leak it.
- Prefer **fine-grained PATs** scoped to the smallest set of repos and permissions needed. Org-owned tokens should be read-only unless write access is required.

## Private repositories

Many personal / org repos are **private**. Anonymous `git clone` or unauthenticated REST calls return **404** even for repos that exist — never conclude "the repo doesn't exist" from a 404. Always retry with credentials first.
