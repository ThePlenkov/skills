# API fallback — GraphQL and streaming search

When the `src` CLI is unavailable (CI environments, restricted
shells, or minimal containers), the same search functionality is
exposed via the Sourcegraph HTTP API.

## GraphQL endpoint

`${SRC_ENDPOINT}/.api/graphql` accepts standard GraphQL queries.
The search query lives under the `search` field.

```sh
AUTH_HEADER="${SRC_HEADER_AUTHORIZATION:-token ${SRC_ACCESS_TOKEN}}"
curl -sS -H "Authorization: ${AUTH_HEADER}" \
     -H 'Content-Type: application/json' \
     -d '{"query":"{ search(query: \"repo:^github\\.com/owner/repo$ NewRequestContext\", version: V3) { results { results { __typename ... on FileMatch { file { path } repository { name } } } } } }"}' \
     "${SRC_ENDPOINT}/.api/graphql"
```

### Escape rules (this is the part everyone gets wrong)

Three layers of escaping are at play: shell, JSON, regex.

| Source code | After shell | After JSON | After regex |
|---|---|---|---|
| `\\\\.com` (4 backslashes) | `\\.com` (2) | `\.com` (1) | matches literal `.` — **this is what you want** |
| `\\.com` (2 backslashes) | `.com` (interpreted as any char) | — | matches any char — **wrong** |
| `\\\.com` (3) | depends on shell | — | depends |

So the rule: in the source code, use `\\\\` (4 backslashes)
before the dot to get a literal-dot regex. Use `\\\\.` to get a
regex that matches a backslash followed by any char (rare).

The same rule applies to every other regex metacharacter that
you want to keep literal: `*`, `+`, `?`, `(`, `)`, `[`, `]`,
`{`, `}`, `|`, `^`, `$`, `\`. Most you can leave as-is in a
keyword pattern (the default), but regex patterns need
double-escaping.

## Streaming endpoint

`${SRC_ENDPOINT}/.api/search/stream` returns results as
Server-Sent Events as the search runs. Useful for long-running
searches that would block a single HTTP request, and the same
endpoint feeds the Sourcegraph web UI.

The streaming API uses the same query string format as the
`search` GraphQL field. The body is a JSON object with a
`query` field. The response is an SSE stream of JSON-encoded
result events, terminated by an `event: done` marker.

## Reading a file

The `repository(...).file(path).content` field reads a file's
contents directly, without going through search:

```sh
src api -query 'query { repository(name: "src-cli", url: "/sourcegraph/src-cli") { file(path: "internal/auth/middleware.go") { content } } }'
```

The same shape works over curl against `/.api/graphql`. Prefer
this over the streaming search API for raw file reads — it's a
single request, no streaming overhead.

## Generating the equivalent curl

The CLI's `-get-curl` flag prints the equivalent curl command for
any `src` call. Use it to bootstrap scripts:

```sh
$ src -get-curl search 'repo:^github\.com/sourcegraph/src-cli$' -limit 5
curl -sS -H "Authorization: token $(src auth token)" \
     -H 'Content-Type: application/json' \
     -d '{"query":"{ search(query: \"repo:^github\\.com/sourcegraph/src-cli$\", version: V3) { ... } }"}' \
     "https://sourcegraph.com/.api/graphql"
```

That output is the authoritative baseline — if the curl in this
file disagrees with what `src -get-curl` produces, trust the CLI.
