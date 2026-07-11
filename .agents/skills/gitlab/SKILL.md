---
name: gitlab
description: Work with GitLab projects, issues, merge requests, pipelines, and releases. Use when interacting with GitLab or GitLab MCP tools, or when you need a CLI fallback.
---

# GitLab

## Overview

Use MCP tools when available. If MCP/tools are unavailable, use the `glab` CLI. If `glab` is missing, recommend installing it.

## Core CLI Operations (glab)

From `glab --help`:

- **auth**: Manage authentication.
- **repo**: Work with repositories and projects.
- **issue**: Work with issues.
- **mr**: Create, view, and manage merge requests.
- **ci / job / schedule**: Work with pipelines and jobs.
- **release**: Manage releases.
- **api**: Make authenticated API requests.
- **snippet**: Manage snippets.
- **variable**: Manage project/group variables.

## Workflow

1. Prefer MCP tools if available.
2. If MCP/tools are unavailable, use `glab` for the task.
3. If `glab` is missing, recommend installing it and continue with guidance.

## Notes

- Validate decisions and data against live sources where possible.
