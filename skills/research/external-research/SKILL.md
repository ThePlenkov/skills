---
name: external-research
description: >-
  Use FIRST when the answer might exist outside the current project.
  Teaches the agent the "is there a native engine for this?" check
  before git clone, grep across repos, or raw web search. The catalog
  (DeepWiki, Sourcegraph, Glean, Rovo, Perplexity, GitHub, GitLab,
  Jira, Confluence, Linear, Notion, npm, PyPI, crates.io) lives in
  references/catalog.md. web_search is LAST resort. Implements
  $skill{token-rationalism} Rule 0 ("search before you read").
tier: 2
triggers: [user, model]
source: theplenkov-ai/skills
---

# External Research — the philosophy, then the catalog

> **The single biggest agent failure mode for outside-the-project
> research: doing it locally when a search engine already has the
> answer.** This skill exists to fix that.

The hard rule, in one line:

> **Before any `git clone`, any grep across repos, any Read-on-foreign-file,
> any web_search for an external thing — pause and ask: "is there a
> native search engine / chat tool that already has this data?"**
> If yes, the answer is one query away and costs a few hundred
> tokens. If you skip the check, you burn 5-50× more tokens on a
> worse answer.

This is **not** a skill about Sourcegraph, or DeepWiki, or Glean.
It's about the **thinking pattern**: prefer the search engine
over the local copy. The catalog below is your checklist of
"things to try before web search."

## The two-token decision (before any external research)

```text
Q1: "Is there a search engine / chat tool that already has this?"
    YES → use it. Stop. (See catalog below.)
    NO  → Q2.

Q2: "Is this about the current project's own code?"
    YES → $skill{investigate-first} (local search, the project's
          own tools, the project's own docs). NOT this skill.
    NO  → web_search as last resort, flag as weak signal.
```

Q1 is the only check that matters. The catalog is in
[`references/catalog.md`](references/catalog.md).

## Catalog (one-line summary — full table in reference)

| Tier | What it is | First try |
|---|---|---|
| **A** | AI chat with grounded search (Sourcegraph Deep Search, Glean, Rovo, Perplexity, Notion AI, Linear AI) | the engine's chat UI / API |
| **B** | Code-specific search (DeepWiki MCP, Sourcegraph `src search`, GitHub/GitLab code search) | the engine's CLI / API |
| **C** | VCS / issue / doc systems (GitHub, GitLab, Jira, Confluence, Linear, Notion, Bitbucket) | the host's MCP server |
| **D** | Package registries (npm, PyPI, crates.io, pkg.go.dev, RubyGems, Maven, NuGet) | the registry's CLI / web page |
| **E** | Web search — **LAST RESORT**, weak signal | `web_search` |

Full tables with "first try / fallback" per engine are in
[`references/catalog.md`](references/catalog.md). The full
decision tree is in
[`references/decision-tree.md`](references/decision-tree.md).

## When this skill is NOT the answer

- **The question is about the current project's own code** →
  `$skill{investigate-first}`. Local search. The current
  project's own tools. Not this skill.
- **The user wants a tutorial on a technology** → that's
  coaching territory, not research.
- **The user wants to change the external code** (open a PR
  upstream) → `$skill{github}` / `$skill{gitlab}` territory,
  not research.
- **The data is in the agent's own memory / scratchpad** → use
  that, no engine needed.

## Relationship to `$skill{token-rationalism}`

This skill is the **implementation mechanism** for
`$skill{token-rationalism}` Rule 0 ("search before you read").
The relevant rules:

- **Token-rationalism Rule 1** (do the work, don't ask
  permission) — combined with this skill: do the search,
  don't ask "should I search?"
- **Token-rationalism Rule 4** (documentation skepticism) —
  before writing a doc, check if the engine already has it.
- **Token-rationalism Rule 0** (search before you read) —
  when the engine has the answer, don't invest more tokens,
  USE the engine.

If the agent profile is loaded with `token-rationalism` (Tier
0, always-on), this skill should be considered always-on in
spirit. Any research task should run the two-token decision
above before any local work.

## References index

| Reference | What it covers |
|---|---|
| [`references/catalog.md`](references/catalog.md) | The full catalog — Tier A through E with "first try / fallback" per engine |
| [`references/decision-tree.md`](references/decision-tree.md) | Full decision tree + use-case table |
| [`references/deepwiki-mcp.md`](references/deepwiki-mcp.md) | "How to use DeepWiki MCP" — three ways in, common pitfalls, scope discipline |

## Related skills

- `$skill{token-rationalism}` — the **Tier 0** always-on skill
  this one implements. If token-rationalism is loaded, this
  skill should be considered always-on in spirit.
- `$skill{deepwiki}` — Tier B code search for public GitHub
  repos. Default first stop for any public-repo question.
- `$skill{sourcegraph}` — Tier A + Tier B for corporate code
  (Deep Search + `src search`).
- `$skill{glean}` — Tier A for corporate-wide search (Slack,
  Drive, Jira, Confluence, etc.). The internal "Google."
- `$skill{atlassian}` — Tier C for Jira/Confluence/Bitbucket.
  Includes Rovo (Tier A chat).
- `$skill{github}` / `$skill{gitlab}` — Tier C for VCS
  operations on a known host.
- `$skill{investigate-first}` — for the current project's own
  code. **Do not blur with this skill.**
