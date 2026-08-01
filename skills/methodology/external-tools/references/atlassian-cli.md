# Atlassian CLI (`acli`)

## When to use this reference

- Working with Jira Cloud, Confluence Cloud, or Atlassian admin tasks.
- The MCP / native integration is not available.

## Core operations

From `acli --help`:

- **auth**: Authenticate to use Atlassian CLI.
- **jira**: Jira Cloud commands.
- **confluence**: Confluence Cloud commands.
- **admin**: Admin commands.
- **config**: Change configuration settings.

## Workflow

1. Prefer MCP tools if available.
2. If MCP/tools are unavailable, use `acli` for the task.
3. If `acli` is missing or insufficient, use the Atlassian Cloud REST / GraphQL API directly with an API token in the `Authorization: Basic <base64(email:token)>` header.

## Notes

- Validate decisions and data against live sources where possible.
