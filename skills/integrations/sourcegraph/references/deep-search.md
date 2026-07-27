# Deep Search — agentic research across the org

Deep Search is Sourcegraph's **agentic** AI research tool. Unlike
`src search` (a precise query engine), Deep Search runs an LLM
agent in a loop: it picks internal tools (code search, code
navigation), refines the query, repeats until confident, then
produces a Markdown answer with source attribution.

Available on **Enterprise Starter and Enterprise** plans (not
BYOK). Requires the Sourcegraph Model Provider.

## There is no `src deepsearch` CLI subcommand

Deep Search is invoked through one of three surfaces:

- **Web UI** — `${SRC_ENDPOINT}/deep-search` (most ergonomic;
  SSE-streamed).
- **HTTP API** — `POST ${SRC_ENDPOINT}/.api/deepsearch/` for
  legacy / scripted flows. The `deepsearch.v1.Service` is the
  gRPC service the web UI and API both call.
- **MCP** — `${SRC_ENDPOINT}/.api/mcp/deepsearch` exposes the
  `deepsearch` tool for MCP clients that want the agent without
  writing HTTP.

## Conversation lifecycle

Each interaction is a **Conversation** with states:

`PROCESSING` → `COMPLETED` | `ERROR` (codes like
`ERROR_QUOTA_EXCEEDED`, `ERROR_TOKEN_LIMIT_EXCEEDED`) |
`CANCELED`

Multi-turn: `AddConversationQuestion` flips a `COMPLETED`
conversation back to `PROCESSING` for follow-ups. This is how
you do "drill deeper into the previous answer" without losing
context.

## Configuration requirements (admin-side)

- `"deepSearch.enabled": true` in site config
- Sourcegraph Model Provider configured
- Network: SSE-streamed, so proxies/load balancers must allow
  ≥ 5-minute timeouts
- Per-user limits via Entitlements at `/site-admin/entitlements`

## Scope rule (same as DeepWiki chat)

The prompt must not include internal project names, file paths,
or terminology from the current task. Phrase in the target
repos' vocabulary, or in the question's own generic vocabulary.
See `$skill{external-research}` for the full scope discipline.

## How to use the answer

Treat the answer like a colleague's first draft: spot-check
cited files via `src search` before quoting. Deep Search can
hallucinate file paths and line numbers; the agent's job is to
verify before acting on the answer.

## When Deep Search is the right tool

- "How does auth flow through service X in our monorepo?"
- "What's the API contract for the billing service?"
- "Find all places that need to be updated for the v2 schema"
- "Why does this test fail intermittently?" (with the
  conversation able to read logs, run searches, etc.)

## When NOT to use Deep Search

- You know exactly what symbol or file you want — use
  `src search` for precision
- A single grep across many repos — use `src search` or
  `src search-jobs` for batched parallel speed
- Anything time-sensitive — Deep Search takes minutes; for
  sub-second answers use `src search`
