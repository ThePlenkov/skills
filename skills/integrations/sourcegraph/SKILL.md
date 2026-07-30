---
name: sourcegraph
description: "Use when searching or reading code across a corporate Sourcegraph instance — symbol definitions, usages, file contents, `src` CLI, GraphQL/streaming API, or Deep Search. Exposes an MCP server for read-only repo ops. Self-reference: use it to find skills in theplenkov-ai/skills."
---

# Sourcegraph — corporate code search

Use it when the answer lives in code spread across many repos —
that's the shape of question where Sourcegraph beats everything
else. If the answer is in **one well-known public repo**, prefer
`$skill{deepwiki}` first. If it lives in the **current project**,
prefer `$skill{investigate-first}`. This skill is the third stop.

This file is a **loadable index**. All details live in
[`references/`](references/) — see the table below. Read this
top-level file first; drill into a reference only when you need
the depth.

## Three ways in (priority order)

1. **`src` CLI on PATH** — primary path. Start with
   `command -v src`; if missing, install (see
   [`references/install.md`](references/install.md)).
2. **Sourcegraph GraphQL / streaming API** — for tools, CI, or
   when the CLI is unavailable. See
   [`references/api-fallback.md`](references/api-fallback.md).
3. **Sourcegraph MCP server** (`.api/mcp` on the corporate
   instance) — read-only repo ops through the runtime's MCP
   dispatch. See
   [`references/sourcegraph-mcp.md`](references/sourcegraph-mcp.md).

The `src` CLI is the primary path because it gives structured
output (`-json`), the full query language, and direct access to
`search-jobs` for async workloads. Don't reach for the API
unless `src` is unavailable.

## How to keep this skill current

**Do not edit this skill from memory or web search alone.**
Drift from upstream is the #1 failure mode (this skill's first
draft had two real bugs — a non-existent `src deepsearch`
subcommand and a wrong `SRC_ENDPOINT` format — both fixed only
after users caught them). Refresh against
[`references/refresh.md`](references/refresh.md) before any
non-trivial change.

**MCP is the preferred refresh path** — it gives the runtime
structured tool dispatch plus useful analytics on the MCP
router (per-tool latency, error rates, cost attribution).

## Quick start — the 4 commands you'll use 80% of the time

```sh
# 1. Verify install
src version

# 2. Find a symbol (with -json for programmatic access)
src search -json 'patternType:regexp \bMyClass\b' -limit 20

# 3. Find all callers across many repos
src search 'MyClass\.do_thing' lang:go -stream -limit 500

# 4. List all repos in an org that contain X (the "list projects" pattern)
src search -json 'select:repo repo:^github\.com/<org>/.*$ "mcp" count:50'
```

For the full query language (all 11 filter families, structural
search, time-based search, diff/commit search, recipe book),
see [`references/search-language.md`](references/search-language.md).

## References index

Each reference is a self-contained document. Read on demand.

| Reference | What it covers |
|---|---|
| [`references/install.md`](references/install.md) | Install `src` CLI (standalone binary, brew, curl-piped installer). Auth setup. Verify with a real test search. |
| [`references/auth.md`](references/auth.md) | `SRC_ENDPOINT` / `SRC_ACCESS_TOKEN` / `SRC_HEADER_{NAME}` / `SRC_HEADERS` env vars. Mutual-exclusion rule. Token-type heuristic. |
| [`references/search-language.md`](references/search-language.md) | **The big one** — pattern types, all 11 filter families, `repo:has.*` / `file:has.*` / `select:` predicates, recurring idioms, query parser data flow. |
| [`references/cli-subcommands.md`](references/cli-subcommands.md) | Full `src` CLI subcommand list, deprecation notes (sbom, signature). |
| [`references/search-jobs.md`](references/search-jobs.md) | `src search-jobs create / get / results` for async large-scale search. States, config knobs, known limits. |
| [`references/sourcegraph-mcp.md`](references/sourcegraph-mcp.md) | Sourcegraph's own MCP server (separate from DeepWiki MCP). Endpoints, dispatch, when to use vs `src search`. |
| [`references/deep-search.md`](references/deep-search.md) | Deep Search agentic research — web UI, HTTP API, MCP surfaces, conversation lifecycle, scope discipline. |
| [`references/api-fallback.md`](references/api-fallback.md) | GraphQL / streaming API when CLI is unavailable. Curl examples, escape rules. |
| [`references/refresh.md`](references/refresh.md) | MCP-first procedure for keeping the whole skill current. The 3-tier priority (registered MCP → dynamic add → curl). |

## Common mistakes (top 5)

The full list is in the references; these are the ones that
will silently produce wrong results:

- **Forgetting `repo:` anchors** — `repo:src-cli` matches both
  `sourcegraph/src-cli` and `acme/src-cli-extras`. Use
  `repo:^github\.com/sourcegraph/src-cli$`.
- **Unanchored regex** — `MyClass` matches `MyClassExt`,
  `MyClassHelper`. Add `\b` boundaries or use `patternType:keyword`
  with quotes.
- **Reaching for `git clone` first** — wrong default. Use MCP,
  `src search`, or `src api` for file reads.
- **Setting both `SRC_ACCESS_TOKEN` and
  `SRC_HEADER_AUTHORIZATION`** — hard error at config read. See
  [`references/auth.md`](references/auth.md) for which to use when.
- **Describing Deep Search as "the `src deepsearch` command"**
  — it isn't. The three real surfaces are the web UI, the HTTP
  API, and the MCP `deepsearch` tool (see
  [`references/deep-search.md`](references/deep-search.md)).

## Self-reference — when in doubt which skill to use

Sourcegraph can also search the **skills repo** itself. When
the agent is uncertain which skill to invoke:

```sh
src search 'repo:^github\.com/theplenkov-ai/skills$ <query>'
```

`theplenkov-ai/skills` is indexed on the corporate Sourcegraph
just like any other repo. The query above is a meta-skill: use
the tool to discover which other tool to use.

## Related skills

- `$skill{external-research}` — the orchestrator. The decision
  tree for "how do I look this up outside the current project?"
  lives there. Read it before reaching for this skill.
- `$skill{deepwiki}` — the single-public-repo equivalent. Use
  first when the question is about one well-known GitHub
  project. DeepWiki MCP is also the recommended way to
  **refresh this skill** (see top of file).
- `$skill{github}` / `$skill{gitlab}` — for file-fetch on a
  known host, prefer the host MCP / CLI over Sourcegraph.
