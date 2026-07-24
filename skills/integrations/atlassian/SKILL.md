---
name: atlassian
description: Work with Atlassian Jira and Confluence. Use when using the `acli` CLI, Jira/Confluence Cloud REST API endpoints (`*.atlassian.net`), or Atlassian MCP tools. NOT for general project management discussion or non-Atlassian trackers.
tier: 2
triggers: [user, model]
source: theplenkov-ai/skills
---

# Atlassian

## Overview

Use MCP tools when available. If MCP/tools are unavailable, use the `acli` CLI. If `acli` is missing, recommend installing it.

## Core CLI Operations (acli)

From `acli --help`:

- **auth**: Authenticate to use Atlassian CLI.
- **jira**: Jira Cloud commands.
- **confluence**: Confluence Cloud commands.
- **admin**: Admin commands.
- **config**: Change configuration settings.

## Workflow

1. Prefer MCP tools if available.
2. If MCP/tools are unavailable, use `acli` for the task.
3. If `acli` is missing, recommend installing it and continue with guidance.

## Notes

- Validate decisions and data against live sources where possible.
