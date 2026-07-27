# `src` CLI subcommands — full reference

The `src` CLI v5+ exposes the following top-level subcommands.
The main `SKILL.md` covers `search`, `search-jobs`, and `api` in
detail; this file lists the rest.

## Core

| Command | Purpose |
|---|---|
| `src search` | Run a code search. See `SKILL.md`. |
| `src search-jobs` | Async large-scale search. See `SKILL.md`. |
| `src api` | Execute arbitrary GraphQL requests. See `SKILL.md`. |
| `src batch` | Manage Batch Changes (create, apply, preview). |
| `src ext svc` | Manage code host connections (GitHub, GitLab, etc.) on a Sourcegraph instance. |

## Auth and credential reuse

| Command | Purpose |
|---|---|
| `src login <endpoint>` | OAuth login to a Sourcegraph instance. Sets `SRC_ENDPOINT` and an OAuth token. |
| `src auth status` | Print the current auth state (which endpoint, which token type, when it expires). |
| `src auth token` | Print the raw token value. Useful for forwarding to curl. |
| `src auth token --header` | Print the full `Authorization: <scheme> <token>` header. |

## Code and user management (admin)

| Command | Purpose |
|---|---|
| `src users list` / `get` / `create` / `delete` | Administer user accounts. |
| `src orgs list` / `get` / `create` / `delete` | Administer organizations. |
| `src orgs members list` / `add` / `remove` | Manage org membership. |

## Prompts

| Command | Purpose |
|---|---|
| `src prompts list` / `get` / `create` / `update` / `delete` | CRUD on Sourcegraph Prompts. |
| `src prompts import` / `export` | Bulk import/export prompt definitions. |
| `src prompts tags list` / `create` / `delete` | Manage prompt tags. |

## Supply chain (deprecated as of 7.0.2852)

| Command | Status |
|---|---|
| `src sbom fetch -v <version>` | **Deprecated.** Fetches and verifies cryptographically signed SBOMs. Only worked for releases between 5.9.0 and 7.0.2852. |
| `src signature verify -v <version>` | **Deprecated.** Uses `cosign` to validate container image signatures. Only worked for releases between 5.11.4013 and 7.0.2852. |

If you need supply-chain verification on current versions, use
Sigstore / `cosign` directly against the published artifacts, not
through `src`.

## Flags common to most subcommands

| Flag | Effect |
|---|---|
| `-endpoint <url>` | Override `SRC_ENDPOINT` for one call. |
| `-token <pat>` | Override `SRC_ACCESS_TOKEN` for one call. |
| `-get-curl` | Print the equivalent `curl` command instead of running it. Useful for debugging and for chaining into other tools. |
| `-json` | Output machine-readable JSON (where supported). |
| `-trace` | Print HTTP request/response details for debugging. |

The `-get-curl` flag is particularly useful: it lets you take any
`src` call and convert it into a copy-pasteable `curl` invocation
with the auth header already set, ready to feed into other tools
or save as a script.
