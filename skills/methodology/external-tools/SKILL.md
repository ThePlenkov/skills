---
name: external-tools
description: Use when an external tool, service, CLI, or API is the right engine for a task. Teaches the universal MCP → CLI → native API fallback chain, with lazy references for per-tool specifics. NOT for general discussion of those platforms.
---

# External tools

Most tasks can be solved through one of three interfaces, in this order:

1. **MCP / native agent integration** — fastest and most reliable when available.
2. **Official CLI** — the tool's first-party command-line client.
3. **Raw REST / GraphQL API** — the last-resort interface when the endpoint is reachable and credentials are valid.

Pick the highest interface that is already authenticated and reachable. Only drop to the next one when the higher one is missing, broken, or lacks the required capability. Document the decision in the chat so the user can reproduce it.

## Decision chain

```
Task needs external tool/service
        │
        ├── MCP or built-in integration available? ──────► use it
        │
        ├── Official CLI installed and authenticated? ──► use CLI
        │
        └── CLI missing / insufficient? ──────────────────► use native API
```

For each interface:

- **Verify auth first.** A failing command because of missing auth looks like a bug. Run `auth status`, `login`, or a lightweight read before the real work.
- **Use pinned versions** for `npx` invocations (`npx --yes tool@x.y.z`) to avoid supply-chain surprises.
- **Respect `NO_PROMPT` / non-interactive flags** when automating CLIs (`gh`, `glab`, etc.) so menus don't hang.
- **Never commit tokens.** Reference secrets through the platform secret store or environment variables; never paste values into files, commits, or chat output.
- **Validate against live sources** when the claim matters (e.g. issue exists, pipeline status, artifact present).
- **Gate every write.** For non-idempotent operations (`glab ci run`, `glab ci trigger`, `git push`, etc.), validate the target/ref, obtain explicit authorization, confirm the exact target, and verify postconditions. Retry only when an idempotency mechanism is available.

## Tool-specific playbooks

| Tool / platform | Where the details live |
| --- | --- |
| Atlassian Jira / Confluence / `acli` | [references/atlassian-cli.md](references/atlassian-cli.md) |
| GitHub CLI (`gh`) and auth patterns | [references/github-auth.md](references/github-auth.md) |
| GitLab REST / GraphQL API | [references/gitlab-api.md](references/gitlab-api.md) |
| GitLab CLI (`glab`) non-interactive mode | [references/gitlab-cli.md](references/gitlab-cli.md) |

Reach for the relevant reference only after the universal chain above has decided which interface to use.
