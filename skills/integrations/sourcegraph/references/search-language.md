# Search Query Language — full reference

_Refreshed 2026-07-27 from `sourcegraph/docs` via DeepWiki MCP. Citations in
brackets point at the source page where the canonical answer lives._

Sourcegraph Code Search is a multi-modal query engine. A query has two
parts:

- **search pattern** — what content to match (the bare words / regex /
  Comby expression)
- **search filters** — scope, refinements, output shape (everything that
  starts with a keyword like `repo:`, `file:`, `lang:`, `type:`)

## Pattern types

Three ways to interpret the search pattern. Set with `patternType:` (default
since v5.4 is `keyword`). All values can also be written lowercase
(`patterntype:`).

### `patternType:keyword` (default since v5.4)

Individual terms anywhere in a document or filename. Spaces are `AND`.
[source: `docs/code-search/queries/index.mdx:33-36`]

| Syntax | Description |
|---|---|
| `foo bar` | both `foo` AND `bar` must appear |
| `"foo bar"` | exact phrase; the space is literal |
| `/foo.*bar/` | inline RE2 regex (only inside the slashes) |

### `patternType:regexp`

All search patterns are RE2 regex. Spaces between non-whitespace strings are
interpreted as `.*?` (fuzzy match) unless escaped or quoted. Sourcegraph
uses **RE2** (not PCRE) — worst-case linear evaluation, no backreferences.
[source: `docs/code-search/queries/index.mdx:50-55`,
`docs/code-search/features.mdx:74-79`]

### `patternType:structural`

[Comby syntax](https://comby.dev/docs/syntax-reference) — match code by
parse tree, respecting balanced delimiters `()`, `[]`, `{}`. **Disabled by
default** in v5.x; requires
`experimentalFeatures.structuralSearch = "enabled"` in site config. Not
actively developed, has known performance limits.
[source: `docs/code-search/types/structural.mdx:18-62`]

| Comby | Alias | Description |
|---|---|---|
| `...` | `:[hole]` | lazy match of zero or more characters, including newlines |
| `:[~regexp]` | — | match an arbitrary RE2 regex |
| `:[[hole]]` | `:[~\w+]` | match one or more alphanumeric characters |

The `lang:` filter is critical for structural accuracy — tells the parser
the language-specific comment / string / code boundaries.

## Boolean logic

`AND` binds tighter than `OR` — `foo or bar and baz` = `foo or (bar and baz)`.
`NOT` is the dash prefix: `-file:test` excludes files matching `test`.
[source: `docs/code-search/queries/language.mdx:27-31`]

## Repository filters

### `repo:<regexp>`

Match repo name by regex. Use `-repo:` to exclude. Most common mistake is
failing to anchor with `^...$` — `repo:src-cli` matches both
`sourcegraph/src-cli` and `acme/src-cli-extras`. Use
`repo:^github\.com/sourcegraph/src-cli$` for a single repo.
[source: `docs/code-search/queries/language.mdx:57-59`]

### `rev:<revision>`

Single branch, tag, or commit SHA. Forms:

| Form | Example | Meaning |
|---|---|---|
| Branch | `rev:main` | a branch |
| Tag | `rev:v3.15` | a tag |
| SHA | `rev:1735d48` | a commit (prefix or full) |
| Multi-rev | `rev:v4.5.0:v5.0.0` | search multiple revs at once |
| Glob | `rev:*refs/heads/*` | every branch |
| Glob | `rev:*refs/tags/*` | every tag |
| Time | `rev:at.time(2 years ago)` | repo at a point in time (≥v5.4) |
| Time+anchor | `rev:at.time(2021-01-30, v5.0.0)` | time, starting search from a specific rev |
| Perforce | `rev:changelist/12345` | a Perforce changelist |

`rev:` is **explicitly disallowed** with `repo:has.file(...)` queries to
prevent unexpected behavior.
[source: `docs/code-search/queries/language.mdx:77-94`]

### `repo:has.*` predicates

The "**find repos that have X**" family. Distinct from the `repo:` filter
(which matches by name).

| Predicate | Syntax | Example | Notes |
|---|---|---|---|
| `repo:has.path` | `repo:has.path(regexp)` | `repo:has.path(README)` | repo contains file path matching regexp. Alias: `repo:contains.path(...)`. |
| `repo:has.content` | `repo:has.content(regexp)` | `repo:^github\.com/sourcegraph/.*$ repo:has.content(TODO)` | repo has file content matching regexp. Alias: `repo:contains.content(...)`. |
| `repo:has.file` | `repo:has.file(path:re content:re)` | `repo:has.file(path:CHANGELOG content:fix)` | repo has a file matching both path and content regexp. Alias: `repo:contains.file(...)`. |
| `repo:has.topic` | `repo:has.topic(topic_name)` | `repo:has.topic(code-search)` | GitHub/GitLab topic. **GitHub and GitLab only.** |
| `repo:has.meta` | `repo:has.meta(key:value)` or `repo:has.meta(key)` | `repo:has.meta(team:sourcegraph)` | sourcegraph repo metadata key/value. Supports regex: `repo:has.meta(team:/[src]{3}graph/)`. |
| `repo:has.commit.after` | `repo:has.commit.after(time_string)` | `repo:has.commit.after(1 month ago)` | filters out repos with no commits past the time. Alias: `repo:contains.commit.after(...)`. |
| `repo:has.description` | `repo:has.description(regexp)` | `repo:has.description(go package)` | repo description text matches. |

## File filters

### `file:<regexp>`

Match the full file path. Use `-file:` to exclude. Path is matched against
the path relative to repo root. Examples:
`file:\.go$`, `file:internal/auth/.*\.go`.
[source: `docs/code-search/queries/language.mdx:99-101`]

### `file:has.*` predicates

| Predicate | Syntax | Example | Notes |
|---|---|---|---|
| `file:has.content` | `file:has.content(regexp)` | `file:has.content(Copyright) Sourcegraph` | only files that contain a match. Alias: `file:contains.content(...)`. **Not supported in Search Jobs.** |
| `file:has.owner` | `file:has.owner(string)` | `file:has.owner(alice@sourcegraph.com) Sourcegraph` | only files with the given owner. Empty `file:has.owner()` = any owner; `-file:has.owner()` = no owner. |
| `file:has.contributor` | `file:has.contributor(regexp)` | `file:has.contributor(alice) Sourcegraph` | only files whose contributor name/email matches. |
| `file:has.path` | — | — | does not exist. Use `file:` directly. |

[source: `docs/code-search/queries/language.mdx`,
`docs/code-search/queries/examples.mdx`]

## Content and metadata filters

### `lang:<language>` (alias: `language:`)

Programming language. Most useful names are standard (`go`, `typescript`,
`python`, `rust`, `java`) plus Sourcegraph-specific ones (`markdown`,
`jsonnet`, `dockerfile`). Critical for structural search accuracy.
[source: `docs/code-search/queries/language.mdx:110-112`]

### `content:"<literal>"`

Wrap the search pattern explicitly. Use when the literal you want to find
would otherwise be parsed as a filter or boolean operator. Example:
`content:"repo:sourcegraph"` finds the literal text, doesn't apply the
`repo:` filter.

### `type:<kind>`

Change the search target. Values:

| Value | What it returns |
|---|---|
| `type:file` (default) | file content matches |
| `type:symbol` | ctags/scip symbols |
| `type:repo` | repository matches (equivalent to `select:repo` without a pattern) |
| `type:path` | file path matches |
| `type:diff` | diffs (changes between revs) |
| `type:commit` | commit messages |

[source: `docs/code-search/queries/index.mdx:16-16`]

### `select:<entity>`

Returns **only** the chosen entity, even if the search matches other types.
This is the deduplication / reshaping tool.

| Value | Returns |
|---|---|
| `select:repo` | one row per repo (regardless of how many matches) |
| `select:file` | full file path. Alias: `select:file.path` |
| `select:file.path` | same as `select:file` |
| `select:file.directory` | directory paths only |
| `select:file.owners` | CODEOWNERS entries for the matching files |
| `select:content` | content matches only |
| `select:symbol` | symbols |
| `select:symbol.function` | only function symbols |
| `select:commit` | commit results |
| `select:commit.diff.added` | only added code in diffs |
| `select:commit.diff.removed` | only removed code in diffs |

`select:` is the right tool for "list all repos that contain X" — the
canonical "find all MCP servers in org Y" pattern in
`$skill{external-research}` uses
`select:repo file:README.md "mcp" "abap" patternType:regexp`.

## Result control

### `count:<N>` and `count:all`

`count:N` returns up to N results. `count:all` waits for all results
(slower; required for Code Insights).
[source: `docs/code-search/queries/examples.mdx`]

### `timeout:<go-duration>`

Go `time.ParseDuration` format: `10s`, `100ms`, `1m30s`. Default is 10s;
hard cap is 1 minute (admins can raise via site config).
[source: `docs/code-search/queries/language.mdx`]

### `case:yes` / `case:no` / `case:auto`

Case sensitivity. Default is **insensitive** (case:`auto` = insensitive).
`case:yes` forces case-sensitive matching. Note: this is a separate filter
from `patternType:` and is most useful with `keyword` patterns; `regexp` is
sensitive by default if you write `Foo` literally.
[source: `docs/code-search/queries/language.mdx`]

## Repository state

### `fork:yes` / `fork:no` / `fork:only`

Include forks, exclude forks, or **only** forks. Default is `fork:no`
(excludes forks).

### `archived:yes` / `archived:no` / `archived:only`

Same shape for archived repos. Default `archived:no`.

### `visibility:any` / `visibility:public` / `visibility:private`

Filter by repo visibility. Default is `visibility:any` (both public and
private). On a corporate instance with private repos, `visibility:private`
is how you scope to internal code.
[source: `docs/code-search/queries/language.mdx`]

## Time-based filters (commit, diff)

| Filter | Syntax | Example |
|---|---|---|
| `author:` | `author:"name or email"` | `author:"alice@sourcegraph.com"` |
| `-author:` | exclude | `-author:bot` |
| `before:` | `before:"2 weeks ago"` or `before:"2024-01-15"` | commit date before |
| `after:` | `after:"1 week ago"` | commit date after |
| `message:` | `message:"any string"` | commit message contains |
| `-message:` | exclude | `-message:"automated"` |

`before:` / `after:` / `author:` / `message:` only apply to `type:diff` and
`type:commit` searches.
[source: `docs/code-search/queries/language.mdx`]

## Recurring idioms (the practical 80%)

### Three shapes of question

#### Find a symbol definition

```sh
src search 'patternType:regexp func NewRequestContext\(' -limit 20
```

#### Find all callers / usages

```sh
src search 'patternType:regexp NewRequestContext\(' lang:go -limit 100
```

**Enumerate repos by topic** — pair `select:repo` with a file-pattern
constraint to get a deduplicated list of repos whose code (not
just metadata) matches your criteria. This is the canonical way
to find "all repos in org X that are MCP servers talking to Y":

```sh
src search -json 'select:repo file:README.md "mcp" "abap" patternType:regexp count:50'
```

`-json` returns a structured `Results` array with `__typename`,
`name`, `externalURLs`. Use it for programmatic enumeration
(matching the "find all X MCP projects" pattern in
`$skill{external-research}`).

**Read a specific file (instead of `git clone`)** — use the API
fallback (the CLI doesn't have a direct file-fetch command):

```sh
src api -query 'query { repository(name: "src-cli", url: "/sourcegraph/src-cli") { file(path: "internal/auth/middleware.go") { content } } }'
```

For raw file fetch, prefer the Sourcegraph MCP
(`$skill{sourcegraph}` → `references/sourcegraph-mcp.md`) or the
GraphQL `file.content` over the streaming search API.

### Find all repos in an org that contain a term (the "list projects" pattern)

```sh
src search -json 'select:repo repo:^github\.com/<org>/.*$ "mcp"'
```

### Find all repos that have a `package.json` mentioning X

```sh
src search -json 'select:repo file:package.json "mcp" "abap" patternType:regexp'
```

### Find symbol definitions (Go)

```sh
src search 'patternType:regexp \bfunc NewRequestContext\b' lang:go
```

### Find usages across many repos

```sh
src search 'NewRequestContext' -stream -limit 500
```

### Recent secrets / private keys

```sh
src search '-----BEGIN [A-Z ]*PRIVATE KEY----- patternType:regexp' -limit 50
```

### Find all dependencies on a library version (recently added)

```sh
src search 'file:package.json "react@18" type:diff after:"1 week ago"'
```

### Code debt / tech debt signals

```sh
src search '-file:\.(json|md|txt)$ (hack|todo|kludge|fixme)' patternType:regexp
```

### Repos with TODOs that should have been cleaned up

```sh
src search 'select:repo repo:^github\.com/<org>/.*$ TODO' \
          -json | jq '.Results[].name'
```

### Find all repos in an org that have ANY mention of MCP

```sh
src search -json 'select:repo repo:^github\.com/.*$ repo:has.topic(mcp-server)'
```

### Search across all branches and tags (slow — use Search Jobs)

```sh
src search-jobs create -query 'patternType:regexp "secret" lang:go'
```

States: `PROCESSING` → `COMPLETED` | `ERROR` (codes like
`ERROR_QUOTA_EXCEEDED`) | `CANCELED`.

## Query parser data flow (debugging only)

When Sourcegraph parses a query, the input goes through:

```
Raw Query String
  → Query Parser
  → Lexer (tokenization)
  → Expression Tree Builder
       ├ AND (higher precedence)
       ├ OR
       └ NOT (-)
  → Internal Search Expression
  → Backend dispatch:
      - Zoekt   (indexed, default branch + multi-branch up to 64)
      - Searcher (unindexed, any branch/commit)
```

Indexed search excludes files > 1MB, binary files, and non-UTF-8 files by
default. Use `search.largeFiles` site config to override.
[source: `docs/admin/search.mdx:68-105`]

## Notes / version requirements

- `rev:at.time(...)` — **requires v5.4+**.
- `patternType:keyword` is the default since **v5.4** (before that,
  `standard` was the default).
- `patternType:structural` is **disabled by default** in v5.x — needs site
  config flag.
- `timeout:` capped at 1 min unless admin raises it.
- `file:has.*` predicates **not supported in Search Jobs**.

## Sources

- [Search Query Language](https://deepwiki.com/sourcegraph/docs#5.1)
- [Search Features & Working with Results](https://deepwiki.com/sourcegraph/docs#5.2)
- [Source mdx files in sourcegraph/docs](https://github.com/sourcegraph/docs/tree/main/docs/code-search)
