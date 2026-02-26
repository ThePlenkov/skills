# Skills Index

This folder contains agent-agnostic, generic skills (no company-specific content).
Skills are organized by subject into a deep folder structure.

## Structure

```
.agents/skills/
├── .system/                   # Agent behavioral rules & meta
├── integrations/              # Platform integrations (high-level workflows)
├── tools/                     # CLIs and standalone tools
├── change-management/         # How we submit changes
├── development/               # Development practices & methods
├── project-management/        # Planning & coordination
├── testing/                   # (future)
└── documentation/             # (future)
```

## .system

| Skill | Description |
|-------|-------------|
| `skill` | Skill system philosophy, discovery, and creation. |
| `skill-sync` | Synchronize skills from multiple source repos into flat `~/.agents/skills/`. |
| `subagents-setup` | Agent hierarchy, delegation rules, and task boundaries. |
| `retrospect` | Self-reflection, mistake capture, and guardrails. |

## integrations

| Skill | Description |
|-------|-------------|
| `github` | GitHub workflows with MCP or `gh` CLI fallback. |
| `gitlab` | GitLab workflows with MCP or `glab` CLI fallback. |
| `atlassian` | Jira & Confluence workflows with MCP or `acli` CLI fallback. |

## tools

| Skill | Description |
|-------|-------------|
| `claude-skills` | Claude-specific skill symlink management. |

## change-management

| Skill | Description |
|-------|-------------|
| `git-commit` | Structured git commit workflow with message conventions. |

## development

| Skill | Description |
|-------|-------------|
| `spec-kit` | Spec-Driven Development with GitHub Spec Kit. |

## project-management

| Skill | Description |
|-------|-------------|
| `shared-plan` | Shared planning and coordination across agents. |

## Add a skill

1. Choose the appropriate category folder (or create a new one).
2. Create `<skill-name>/SKILL.md` inside that category.
3. Add YAML frontmatter: `name`, `description`, optional `version` and `prerequisites`.
4. Optional: add `assets/`, `references/`, or `scripts/` inside the skill folder.
5. Run `skill-sync` to refresh symlinks in `~/.agents/skills/`.
6. Update this index.
