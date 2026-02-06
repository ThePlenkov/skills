# Skills Index

This folder contains agent-agnostic skills.

## Skills
- `atlassian`: Jira/Confluence workflows with MCP or `acli` fallback.
- `github`: GitHub workflows with MCP or `gh` fallback.
- `gitlab`: GitLab workflows with MCP or `glab` fallback.
- `retrospect`: Capture mistakes and prevention steps.
- `shared-plan`: Shared planning workflow and templates.
- `subagents-setup`: Role hierarchy and delegation rules.

## Add a skill
1. Create a folder under `.agents/skills/<skill-name>/`.
2. Add a `SKILL.md` file that describes how to use the skill.
3. Optional: add `assets/`, `references/`, or `scripts/` inside the skill folder.
4. Update this index with a short description.
