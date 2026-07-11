---
name: glean
description: "Use the glean-bk wrapper for Glean CLI with automatic OAuth token sync from bk CLI. Trigger when the user asks to search Glean, chat with Glean, or interact with the Glean API."
---

# Glean CLI (via glean-bk)

Use the `glean-bk` wrapper for Glean operations instead of the Docker MCP Toolbox (`toolbox__glean_*`). The wrapper automatically syncs OAuth tokens from bk CLI and handles token refresh.

## Prerequisites

- `glean-bk` installed (`brew install petr-plenkov/tools/glean-bk`)
- `bk` CLI with Glean OAuth configured
- Authenticated via bk (`bk genai:mcp:auth --action auth --service glean --yes`)

## Quick Reference

|| Task | Command |
||------|---------|
|| **Check auth** | `glean-bk auth status` |
|| **Search** | `glean-bk search "query"` |
|| **Chat** | `glean-bk chat "question"` |
|| **Chat (no history)** | `glean-bk chat --save=false "question"` |
|| **API call** | `glean-bk api /rest/api/v1/search -d '{"query":"..."}' -X POST` |
|| **Refresh tokens** | `bk genai:mcp:auth --action auth --service glean --yes` |

## How glean-bk Works

The wrapper automatically:

1. Validates bk OAuth tokens for Glean
2. Refreshes tokens if expired via `bk genai:mcp:auth`
3. Syncs tokens from bk to Glean CLI storage
4. Exports environment variables
5. Runs `glean` CLI with your arguments

## First-Time Setup

1. Install glean-bk:

```bash
brew tap petr-plenkov/tools git@gitlab.com:booking-com/personal/petr.plenkov/homebrew-tools.git
brew trust petr-plenkov/tools
brew install petr-plenkov/tools/glean-bk
```

1. Authenticate Glean via bk:

```bash
bk genai:mcp:auth --action auth --service glean --yes
```

1. Verify:

```bash
glean-bk auth status
```

## Why glean-bk Instead of Direct glean CLI?

- **Automatic token sync**: bk CLI tokens automatically synced to Glean CLI storage
- **No manual OAuth setup**: No need for `~/.glean/config.json` with client credentials
- **Token refresh**: Automatic refresh via bk when tokens expire
- **Single source of truth**: All OAuth tokens managed through bk CLI

## Why Not Docker MCP Toolbox?

- Toolbox requires a running Docker container, OAuth token seeding, and volume management
- Glean OAuth flow via Toolbox was never fully completed (missing `oauth-tokens.json`)
- glean-bk handles token refresh natively — no manual re-seeding needed
- Direct CLI calls are faster than MCP JSON-RPC round-trips

## Usage Examples

### Search

```bash
glean-bk search "quarterly OKRs"
```

### Chat (scripting-friendly)

```bash
glean-bk chat --save=false "Summarize the latest incident report"
```

### Raw API

```bash
glean-bk api /rest/api/v1/chat -X POST -d '{
  "messages": [{"author":"USER","messageType":"CONTENT","fragments":[{"text":"What is Glean?"}]}]
}'
```

## Troubleshooting

|| Issue | Solution |
||-------|----------|
|| `bk tokens not found` | Run `bk genai:mcp:auth --action auth --service glean --yes` |
|| 401 after bk auth | Run via `glean-bk` (sync step missing with plain `glean`) |
|| Token extraction fails | Check `~/.bkcloud/oauth-tokens.json` exists and has `bk-genai-glean` entry |

## Reference

- glean-bk repo: <https://gitlab.com/booking-com/personal/petr.plenkov/glean-bk>
- Homebrew tap: <https://gitlab.com/booking-com/personal/petr.plenkov/homebrew-tools>
- Glean CLI repo: <https://github.com/gleanwork/glean-cli>
