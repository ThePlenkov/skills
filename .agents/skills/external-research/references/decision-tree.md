# Full decision tree + use cases

## The full decision tree

```text
need to understand / locate / read code or data outside current project
│
├─ is there a native search engine / chat tool for this?
│   ├─ AI chat with grounding (Tier A) → ask the chat, cite the source
│   ├─ Code search (Tier B)            → run the engine's query
│   ├─ VCS / issue / doc system (Tier C) → use the host's MCP / CLI
│   └─ Package registry (Tier D)        → query the registry
│       (one of the above is almost always available)
│
├─ did the engine answer?
│   YES → spot-check the cited file / symbol before treating as authoritative
│   NO  → try the next engine in the catalog, top to bottom
│
├─ is it about the current project's own code?
│   YES → $skill{investigate-first}. NOT this skill.
│
└─ nothing in the catalog fit and the data isn't local either?
    └─ web_search — flag result as weak signal, corroborate
```

**Run the catalog top-to-bottom, not in parallel.** Earlier
engines are cheaper, more grounded, and often make later
questions unnecessary. Parallel catalog runs multiply tokens
for no gain.

## Catalog in priority order (deeper)

This is the catalog from the main file, expanded with concrete
"what to actually type" examples for each engine. Reach for
these in order; stop at the first one that answers.

### Tier A — AI chat with grounded search

| Engine | First try | Fallback |
|---|---|---|
| **Sourcegraph Deep Search** (corporate) | `${SRC_ENDPOINT}/deep-search` (web UI); MCP `${SRC_ENDPOINT}/.api/mcp/deepsearch` for the `deepsearch` tool | HTTP API `POST ${SRC_ENDPOINT}/.api/deepsearch/` |
| **Glean** | `glean chat --query "..."` (via `$skill{glean}` wrapper) | web UI; REST API with OAuth |
| **Atlassian Rovo** | `acli rovo chat --query "..."` (via `$skill{external-tools}`) | web UI; Rovo API |
| **Perplexity** | Perplexity API / chat UI | (no public MCP yet) |
| **Notion AI / Linear AI** | the product's native chat | the product's REST API |
| **ChatGPT / Claude with web search** | the chat UI with web search enabled | the host's API (if your runtime is itself Claude) |

### Tier B — Code-specific search

| Engine | First try | Fallback |
|---|---|---|
| **DeepWiki MCP** | `deepwiki.ask_question(repoName="owner/repo", question="...")` | curl directly to `https://mcp.deepwiki.com/mcp` (see `references/deepwiki-mcp.md`) |
| **Sourcegraph `src search`** | `src search 'symbol lang:ts' -stream` | GraphQL `/.api/graphql` (see `$skill{sourcegraph}` → `references/api-fallback.md`) |
| **GitHub code search** | `gh search code 'symbol repo:owner/repo' --limit 20` | GraphQL `search(query: "...")` |
| **GitLab code search** | `glab api search?scope=blobs&search=symbol` | the host's REST API |
| **Bitbucket code search** | the host's REST API | web UI |

### Tier C — VCS / issue / doc systems (MCP-first)

| System | First try | Fallback |
|---|---|---|
| **GitHub** | GitHub MCP server (`github-mcp`) — `<runtime-call> github.read_file(...)` | `gh` CLI; REST/GraphQL |
| **GitLab** | GitLab MCP server — `<runtime-call> gitlab.read_file(...)` | `glab` CLI; REST/GraphQL |
| **Atlassian Jira** | `acli jira search --jql "..."` | REST API; web UI |
| **Atlassian Confluence** | `acli confluence search --cql "..."` | REST API; web UI |
| **Linear** | the product's GraphQL API | web UI |
| **Notion** | the product's REST API + Notion AI | web UI |
| **Bitbucket** | the host's REST API | web UI |

### Tier D — Package registries

| Registry | First try |
|---|---|
| **npm** | `npm view <pkg>` (CLI); `https://www.npmjs.com/package/<pkg>` (web) |
| **PyPI** | `pip show <pkg>` (CLI); `https://pypi.org/project/<pkg>/` (web) |
| **crates.io** | `cargo search <term>` (CLI); `https://crates.io/crates/<pkg>` (web) |
| **pkg.go.dev** | `go doc <pkg>` (CLI); `https://pkg.go.dev/<pkg>` (web) |
| **RubyGems** | `gem info <pkg>` (CLI); `https://rubygems.org/gems/<pkg>` (web) |
| **Maven Central** | `https://central.sonatype.com/artifact/<group>:<artifact>` |
| **NuGet** | `https://www.nuget.org/packages/<pkg>` |

### Tier E — Web search

Use `web_search` only when nothing above fits, and always
flag the result as a weak signal. The 3rd–5th result is
usually more accurate than the first.

## Use cases (the intents that fire this skill)

| Intent | First move | Fallback |
|---|---|---|
| "How does library X work?" | Tier D (registry changelog / API docs) | Tier A chat for conceptual comparison; source |
| "Where is symbol Y used?" | Tier B (`src search` / GitHub code search) | local grep via Sourcegraph |
| "Read file Z in repo W" | Tier C (host MCP) | `src` CLI → curl |
| "What's the status of issue I?" | Tier C (Jira/GitHub MCP) | web search as weak signal |
| "What changed in version V?" | Tier D (registry changelog) | GitHub release notes |
| "Compare A vs B" | Tier A chat on each | side-by-side source diff |
| "Find similar projects to X" | Tier A (Perplexity/Glean) | GitHub topic search |
| "Explain error message M" | Tier A (Glean + Perplexity) | Tier B (search the code) |
| "Find a config for service S" | Tier C (Confluence/Glean) | Tier B (the repo) |
| "Translate from language A to B" | Tier A (Perplexity) | (no good fallback; just ask) |
