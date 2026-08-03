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
3. If `acli` is missing or insufficient, use the Atlassian Cloud REST / GraphQL API directly.
   - Pick the product, endpoint, and authentication method supported by that product (Jira Cloud, Confluence Cloud, etc. have different supported flows).
   - For one-off scripts, read the API token from a secret store and use `Authorization: Basic <base64(email:token)>`.
   - For integrations, prefer OAuth 2.0 / 2LO or the product-specific authentication path documented by Atlassian.

## Notes

- Validate decisions and data against live sources where possible.
