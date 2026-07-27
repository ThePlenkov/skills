# Native engine catalog

The full catalog of native search engines / chat tools the
agent might have access to. The agent may have ZERO, SOME, or
ALL of these — the right tool is whichever is available.

**Run top-to-bottom, not in parallel.** Earlier engines are
cheaper, more grounded, and often make later questions
unnecessary. Parallel catalog runs multiply tokens for no gain.

## Tier A — AI chat with grounded search (highest signal)

Search engines with a chat interface, often with built-in
grounding to an internal knowledge corpus. They give **answers,
not link lists** — and they cite their sources.

| Engine | What it indexes | First try | Fallback |
|---|---|---|---|
| **Sourcegraph Deep Search** | Corporate code (private repos, internal forks). Agentic LLM loop. | MCP `${SRC_ENDPOINT}/.api/mcp/deepsearch` (registered or dynamic) | web UI `${SRC_ENDPOINT}/deep-search`; HTTP API `POST ${SRC_ENDPOINT}/.api/deepsearch/` |
| **Glean** | Corporate Slack, Drive, Jira, Confluence, GitHub, Notion, etc. — the internal "Google." Has chat + grounded Q&A. | `glean chat --query "..."` (via `$skill{glean}`) | web UI; REST API with OAuth |
| **Atlassian Rovo** | Jira, Confluence, Bitbucket, plus connected Atlassian products. Agent + chat. | `acli rovo chat --query "..."` (via `$skill{atlassian}`) | web UI; Rovo API |
| **Perplexity** | Public web + AI citations. The "thinking search engine" for any general knowledge question. | Perplexity API / chat UI | (no public MCP yet) |
| **Notion AI** / **Linear AI** | Product docs, project plans, issues. Chat + retrieval. | the product's native chat | the product's REST API |
| **ChatGPT / Claude with web search** | Public web. Use as a last-resort search engine WITH retrieval, not as a substitute for grounded engines. | the chat UI with web search enabled | the host's API (if your runtime is itself Claude) |

**When to use Tier A:** the question is "explain", "summarize",
"compare", "what does X do", "find similar things to Y". Any
question where the answer is a paragraph or a table, not a code
block.

## Tier B — Code-specific search (grounded in code)

Engines that index the code itself. They return file paths,
symbols, and code-shaped evidence. Use them for "find", "where
is", "show me" — questions with a precise answer.

| Engine | What it indexes | First try | Fallback |
|---|---|---|---|
| **DeepWiki MCP** | Public GitHub repos. AI-generated wiki + Q&A + full file reads. | registered or dynamically-registered MCP `deepwiki.ask_question(repoName="owner/repo", question="...")` (see `references/deepwiki-mcp.md`) | curl to `https://mcp.deepwiki.com/mcp` |
| **Sourcegraph `src search`** | Corporate code, public GitHub, any git repo the instance has cloned. Cross-repo regex, structural search, predicates. | `src search 'symbol lang:ts' -stream` | GraphQL `/.api/graphql` (see `$skill{sourcegraph}` → `references/api-fallback.md`) |
| **GitHub code search** | Public GitHub repos. Web UI + GraphQL API + `gh` CLI + GitHub MCP. | `gh search code 'symbol repo:owner/repo' --limit 20` | GraphQL `search(query: "...")` |
| **GitLab code search** | Public + self-hosted GitLab. | `glab api 'search?scope=blobs&search=symbol'` | the host's REST API |
| **Bitbucket code search** | Bitbucket Cloud + Server. | the host's REST API | web UI |

**When to use Tier B:** the question is "find me this symbol",
"where is X defined", "read me file Y", "show me all callers
of Z". Any question with a precise code answer.

## Tier C — VCS / issue / doc systems (MCP-first)

When the answer is in a known system, the system's own MCP
server beats web search. Always check the host's MCP.

| System | Native search surface | First try | Fallback |
|---|---|---|---|
| **GitHub** | MCP server (`github-mcp`), `gh search` CLI, REST/GraphQL | GitHub MCP server — `<runtime-call> github.read_file(...)` | `gh` CLI; REST/GraphQL |
| **GitLab** | MCP server, `glab` CLI, REST/GraphQL | GitLab MCP server — `<runtime-call> gitlab.read_file(...)` | `glab` CLI; REST/GraphQL |
| **Atlassian Jira** | `acli jira search` (JQL), Confluence search, Rovo chat | `acli jira search --jql "..."` | REST API; web UI |
| **Atlassian Confluence** | same | `acli confluence search --cql "..."` | REST API; web UI |
| **Linear** | GraphQL API + native AI | the product's GraphQL API | web UI |
| **Notion** | Notion API + Notion AI | the product's REST API + Notion AI | web UI |
| **Bitbucket** | REST API | the host's REST API | web UI |

**When to use Tier C:** the question is "what's the status of
issue X", "read me the doc Y", "show me the PR Z". Anything
hosted in a known system.

## Tier D — Package registries (canonical sources)

For "how does library X work" — the registry's own page is
usually more accurate than any web summary.

| Registry | What it covers | First try |
|---|---|---|
| **npm** (`npmjs.com`) | JavaScript / TypeScript packages | `npm view <pkg>` (CLI); `https://www.npmjs.com/package/<pkg>` (web) |
| **PyPI** (`pypi.org`) | Python packages | `pip show <pkg>` (CLI); `https://pypi.org/project/<pkg>/` (web) |
| **crates.io** | Rust crates | `cargo search <term>` (CLI); `https://crates.io/crates/<pkg>` (web) |
| **pkg.go.dev** | Go modules | `go doc <pkg>` (CLI); `https://pkg.go.dev/<pkg>` (web) |
| **RubyGems** | Ruby gems | `gem info <pkg>` (CLI); `https://rubygems.org/gems/<pkg>` (web) |
| **Maven Central** | Java / Kotlin / Scala | `https://central.sonatype.com/artifact/<group>:<artifact>` |
| **NuGet** | .NET | `https://www.nuget.org/packages/<pkg>` |

**When to use Tier D:** the question is "what's the latest
version", "what are the API options", "show me the changelog
of version V". Registries beat web summaries.

## Tier E — Web search (LAST RESORT)

`web_search` / `web_fetch` is a **weak signal**. Use only when
all of the above are unavailable or didn't help, AND:

- The question is general knowledge (not about a known repo,
  package, or system).
- You're not asking "is X true about MY code" (no engine can
  answer that — only local search can).
- You're prepared to corroborate the answer with at least one
  other source.

Always flag web_search results as "weak signal" in the report.
Corroborate against another source; rank by authority and
relevance rather than search-result position.
