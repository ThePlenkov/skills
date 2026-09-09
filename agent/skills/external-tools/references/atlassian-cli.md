# Atlassian CLI (`acli`)

## When to use this reference

- Working with Jira Cloud or Atlassian admin tasks.
- The MCP / native integration is not available.

## Core operations

From `acli --help`:

- **jira**: Jira Cloud commands.
- **admin**: Atlassian organization admin commands.
- **feedback**: Send feedback to the `acli` team.
- **rovodev**: Experimental commands.

> `acli` does not expose a top-level `auth`, `confluence`, or `config` command. Authentication is per-product (`jira auth ...`, `admin auth ...`), and Confluence Cloud tasks should be handled through the Confluence Cloud REST API or an integration/MCP tool.

## Workflow

1. Prefer MCP tools if available.
2. If MCP/tools are unavailable, use `acli` for Jira or admin tasks.
   - Authenticate non-interactively **before** running any automated Jira or admin commands.
   - For Jira, use an **API token** from the secret store. The login requires `--site` and `--email`:
     ```bash
     printf '%s\n' "$JIRA_API_TOKEN" | acli jira auth login --site mysite.atlassian.net --email user@example.com --token
     acli jira auth status
     ```
   - For admin tasks, use an **organization API key** from the secret store:
     ```bash
     printf '%s\n' "$ATLASSIAN_ADMIN_API_KEY" | acli admin auth login --email admin@example.com --token
     acli admin auth status
     ```
   - Do not use browser-based OAuth (`--web`) in automation.
3. If `acli` is missing or insufficient, use the Atlassian Cloud REST / GraphQL API directly.
   - Pick the product, endpoint, and authentication method supported by that product (Jira Cloud, Confluence Cloud, etc. have different supported flows).
   - For one-off scripts, read the API token from a secret store and use `Authorization: Basic <base64(email:token)>`.
   - For integrations, prefer OAuth 2.0 / 2LO or the product-specific authentication path documented by Atlassian.

## Notes

- Validate commands against the official [`acli` reference](https://developer.atlassian.com/cloud/acli/reference/commands/) before relying on them in automation.
- Validate decisions and data against live sources where possible.
