# GitLab REST / GraphQL API

## When to use this reference

- Working with GitLab projects, issues, merge requests, pipelines, or releases.
- The MCP / native integration is not available and `glab` CLI is missing or insufficient.

## Core REST areas

- **Projects**: `GET /projects/:id`
- **Issues**: `GET /projects/:id/issues/:issue_iid`
- **Merge requests**: `GET /projects/:id/merge_requests/:mr_iid`
- **Pipelines / jobs**: `GET /projects/:id/pipelines/:pipeline_id` and `GET /projects/:id/pipelines/:pipeline_id/jobs`
- **Releases**: `GET /projects/:id/releases/:tag_name`

## Workflow

1. Prefer MCP tools if available.
2. If MCP/tools are unavailable, use `glab` for the task (see [gitlab-cli.md](gitlab-cli.md)).
3. If `glab` is missing or insufficient, use the REST or GraphQL API directly with a `GITLAB_TOKEN` or `PRIVATE-TOKEN` header.

## Notes

- For self-managed GitLab, set the base URL appropriately (`https://gitlab.example.com/api/v4/...`).
- Validate decisions and data against live sources where possible.
