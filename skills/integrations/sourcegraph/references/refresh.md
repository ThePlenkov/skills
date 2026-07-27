# How to keep the sourcegraph skill current

The single biggest failure mode with skills like `sourcegraph` is
**drift from upstream** — the author writes from memory or web
search and gets the API surface wrong. This file is the procedure
to refresh against the canonical source before any non-trivial
edit.

**MCP is the preferred refresh path.** It gives the runtime
structured tool dispatch plus useful analytics on the MCP router
(per-tool latency, error rates, cost attribution). Three ways in,
in priority order:

## 1. Use the runtime's already-registered MCP server (best)

If the host runtime has a `deepwiki` MCP server already registered
(common in dev/agent stacks that wire it into the platform MCP
gateway), call it through the runtime's documented dispatch API.
Don't reimplement the JSON-RPC plumbing — the runtime does
streaming, retries, and observability for you.

```
<runtime-call> deepwiki.read_wiki_structure(repoName="sourcegraph/docs")
<runtime-call> deepwiki.read_wiki_contents(repoName="sourcegraph/docs")
<runtime-call> deepwiki.ask_question(repoName="sourcegraph/docs", question="...")
```

## 2. Try to register the DeepWiki MCP dynamically

If the host runtime exposes an MCP-management API (e.g.
`mcp-find` / `mcp-add` via a docker-mcp gateway, or a `mavis mcp
add` style subcommand), attempt to add `deepwiki` before falling
back to curl. The MCP server is public and zero-config:

- **Streamable HTTP** (recommended): `https://mcp.deepwiki.com/mcp`
- **SSE** (deprecated): `https://mcp.deepwiki.com/sse`

No auth, no install. Once registered, the runtime's tool-dispatch
API works the same as in (1). The MCP router gets to log the
calls, which is useful for cost/latency observability.

## 3. Curl directly to `mcp.deepwiki.com/mcp` (last resort)

When neither (1) nor (2) is available, hit the JSON-RPC endpoint
directly with `curl`. MCP is just a transport on top of HTTP —
the request is a standard JSON-RPC 2.0 envelope. Both endpoints
require `Accept: application/json, text/event-stream` in the
request header.

## Refresh via the official docs (canonical source)

If DeepWiki is unavailable, the canonical source is the GitHub
repo itself: `https://github.com/sourcegraph/docs`. The relevant
directories are `docs/cli/`, `docs/deep-search/`, and
`docs/code-search/`. The web-rendered version is at
`https://sourcegraph.com/docs/cli/quickstart` and friends.

The `docs/cli/explanations/env.mdx` file in particular is the
single best reference for the env var surface; read it before
editing the auth section of the main SKILL.md.

## Why not the deepwiki.com web UI?

The web UI at `https://deepwiki.com/sourcegraph/docs` is the
canonical landing page but is server-side rendered as a Next.js
shell — `web_fetch` and `curl` return only the loading skeleton, not
the content. The actual content is behind the MCP transport, so
the API calls above are the only way to programmatically read it.
The web UI is fine for humans browsing interactively, not for
agent refresh.

## Common pitfalls when calling `mcp.deepwiki.com`

- **Missing `Accept` header** — server returns
  `"Not Acceptable: Client must accept both application/json and text/event-stream"`.
  Always send `Accept: application/json, text/event-stream`.
- **Using `deepwiki.com/api/mcp` instead of `mcp.deepwiki.com/mcp`** —
  the first is a Next.js page route that returns HTML. The real MCP
  endpoint is the subdomain `mcp.deepwiki.com`.
- **Confusing `read_wiki_contents` with the page number** —
  `read_wiki_contents` returns the **entire** wiki (~9000 lines),
  not a single page. Use the `# Page: <Title>` boundaries (or
  switch to `ask_question` for a single fact) to scope your read.
- **POST without JSON-RPC envelope** — the endpoint requires
  `{"jsonrpc":"2.0","id":N,"method":"...","params":{...}}`.
  Plain JSON in the body returns 405.
