# DeepWiki MCP — the canonical "how to use it" guide

DeepWiki is the most common **public, no-auth** MCP server that
an agent will encounter. It indexes public GitHub repos and
exposes:

- `ask_question(repoName, question)` — AI chat grounded in the
  target repo
- `read_wiki_structure(repoName)` — the wiki's table of contents
- `read_wiki_contents(repoName)` — the full wiki (large; use
  selectively)

The **scope discipline** at the bottom of this file applies to
all of them.

## Three ways in (MCP-first priority)

### 1. Use the runtime's already-registered MCP server (best)

If the host runtime has a `deepwiki` MCP server already
registered (common in dev/agent stacks that wire it into the
platform MCP gateway), call it through the runtime's documented
dispatch API. Don't reimplement the JSON-RPC plumbing — the
runtime does streaming, retries, and observability for you.

```
<runtime-call> deepwiki.ask_question(repoName="<owner>/<repo>", question="...")
<runtime-call> deepwiki.read_wiki_structure(repoName="<owner>/<repo>")
<runtime-call> deepwiki.read_wiki_contents(repoName="<owner>/<repo>")
```

The MCP router gets to log the calls, which is useful for
cost/latency observability.

### 2. Try to register the DeepWiki MCP dynamically (if your runtime supports it)

If the host runtime exposes an MCP-management API (e.g.
`mcp-find` / `mcp-add` via a docker-mcp gateway, or a `mavis mcp
add` style subcommand), attempt to add `deepwiki` before falling
back to curl. The MCP server is public and zero-config:

- **Streamable HTTP** (recommended): `https://mcp.deepwiki.com/mcp`
- **SSE** (deprecated): `https://mcp.deepwiki.com/sse`

No auth, no install. Once registered, the runtime's tool-dispatch
API works the same as in (1).

### 3. Curl directly to `mcp.deepwiki.com/mcp` (last resort)

When neither (1) nor (2) is available, hit the JSON-RPC endpoint
directly with `curl`. MCP is just a transport on top of HTTP —
the request is a standard JSON-RPC 2.0 envelope. Both endpoints
require `Accept: application/json, text/event-stream` in the
request header. The endpoint is on the **subdomain**
`mcp.deepwiki.com` — **not** `deepwiki.com/api/mcp` (that path
is a Next.js page route that returns HTML; common mistake).

```sh
ACCEPT='application/json, text/event-stream'
EP=https://mcp.deepwiki.com/mcp

# 1. List wiki topics
curl -sS -X POST -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"read_wiki_structure",
                 "arguments":{"repoName":"<owner>/<repo>"}}}' \
  "$EP"

# 2. Get full wiki contents
curl -sS -X POST -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"read_wiki_contents",
                 "arguments":{"repoName":"<owner>/<repo>"}}}' \
  "$EP"

# 3. Targeted Q&A (cheaper than re-reading the whole wiki)
curl -sS -X POST -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"ask_question",
                 "arguments":{"repoName":"<owner>/<repo>",
                              "question":"<precise question>"}}}' \
  "$EP"
```

Curl skips the router observability — log the call yourself if
you need the analytics. The response uses SSE framing
(`event: message\ndata: {...}\n\n`); strip the `data:` prefix to
get the JSON body.

DeepWiki's full setup docs are at
`https://docs.devin.ai/work-with-devin/deepwiki-mcp`.

## Common pitfalls (the ones that waste hours)

- **Missing `Accept` header** — "Not Acceptable: Client must
  accept both application/json and text/event-stream". The
  curl example sets `Accept: application/json,
  text/event-stream` exactly. Don't simplify.
- **Using `deepwiki.com/api/mcp`** instead of
  `mcp.deepwiki.com/mcp` — the first is a Next.js page route
  returning HTML. Always use the **subdomain**.
- **`read_wiki_contents` is huge** — returns the full wiki
  (~9000 lines for `sourcegraph/docs`). Use
  `read_wiki_structure` first to find the right section, or
  switch to `ask_question` for a single fact.
- **Passing the question without `repoName`** — the server has
  no way to ground the answer. Always include `repoName`.

## Scope discipline — the leak rule

DeepWiki chat is grounded in the target repo's code — but if
your question includes internal names, file paths, or
conventions from the current project, two bad things happen:

1. DeepWiki may *confabulate* a mapping that doesn't exist in
   the target repo (it has no way to verify your internal
   concept exists there), and the answer comes back sounding
   authoritative.
2. You transmit the shape of your internal design to a
   third-party service that has no business knowing it.

**Rules for the chat prompt:**

- **Pass `repoName` first** — every tool call. Never call
  `ask_question` without it. The target repo is the only corpus
  the answer should draw on.
- **Phrase questions in the target repo's vocabulary** — class
  names, function names, file names that actually appear in the
  target. If you don't know them, `read_wiki_structure` first.
- **Do NOT include** the current project's: file paths,
  internal class names, environment names, customer names,
  org-specific terminology, or anything you'd redact from a
  public post.
- **If you need a mapping** between an internal concept and a
  target concept, ask in general terms first ("How is request
  validation typically done in Express?"), confirm, then ask
  the targeted question using only the target's vocabulary.

The same rule applies in reverse to `$skill{sourcegraph}`
search queries: search by symbol, not by your project's
nickname for it.
