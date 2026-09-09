# Sourcegraph MCP server (separate from DeepWiki MCP)

A corporate Sourcegraph instance exposes its own MCP server for
read-only repository operations. **This is not the same as
DeepWiki MCP** (`mcp.deepwiki.com/mcp`) — DeepWiki indexes public
GitHub repos; the Sourcegraph MCP only sees what your corporate
instance has indexed (private repos, internal forks, etc.).

## Endpoints

- `${SRC_ENDPOINT}/.api/mcp` — core tool suite
  (search, file read, repo list, etc.)
- `${SRC_ENDPOINT}/.api/mcp/all` — full tool suite
  (same tools, exposed under the `/all` path)
- `${SRC_ENDPOINT}/.api/mcp/deepsearch` — focused,
  deep-search-only (no plain `search` tool)
- `${SRC_ENDPOINT}/.api/mcp/v1` — legacy endpoint with
  `sg_`-prefixed tool names (still works for backward
  compatibility)

## Dispatch through the runtime's MCP tool-dispatch API

The Sourcegraph MCP is not a public, no-auth server like
DeepWiki MCP. It runs on your corporate instance, so it requires
the same `SRC_HEADER_AUTHORIZATION` you would use for the
GraphQL API. If your runtime supports per-server auth, configure
it that way; otherwise the runtime should inherit credentials
from the active session.

```
<runtime-call> sourcegraph.search(query="...")
<runtime-call> sourcegraph.read_file(repo="owner/repo", path="...")
<runtime-call> sourcegraph.list_repos(...)
```

## When to use it vs `src search` or DeepWiki MCP

| Use case | Tool |
|---|---|
| Private corporate code, full file reads | **Sourcegraph MCP** (`.api/mcp`) |
| Private corporate code, refactor across many repos | `src search` (more powerful query language) |
| Public GitHub repo analysis | **DeepWiki MCP** (`mcp.deepwiki.com/mcp`) |
| Long-running cross-repo async research | `src search-jobs` or Sourcegraph Deep Search |

## Scope rule (same as DeepWiki chat)

Never include internal project names, file paths, or terminology
from the current task in prompts. The MCP tool description
enforces this implicitly; respect it. See
`$skill{external-research}` for the full scope discipline.

## When the Sourcegraph MCP is NOT available

Some instances don't have the MCP server enabled (older versions,
self-hosted deployments without the feature flag). Fall back to:

1. `src search` for queries
2. `src api -query '...'` for file reads (GraphQL `file.content`)
3. Streaming API at `${SRC_ENDPOINT}/.api/search/stream` (see
   [`references/api-fallback.md`](api-fallback.md))
