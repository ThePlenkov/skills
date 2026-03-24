# Skills Index

This folder contains agent-agnostic, generic skills (no company-specific content).
Skills live directly under `.agents/skills/<skill-name>/`.

## Structure

```
.agents/skills/
├── .system/                   # Agent behavioral rules & meta
├── cognitive/                 # Agent cognition & reasoning behavior
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
| `dotagents` | Framework lifecycle: `/dotagents init`, `install`, `sync`, `list`. Includes skill philosophy, subagent hierarchy, and sync script. |
| `memory` | Persistent memory enforcement — recall before acting, persist after learning. Integrates with `$retrospect`. |
| `retrospect` | Self-correction protocol — persist fixes that prevent recurrence. |

## cognitive

| Skill | Description |
|-------|-------------|
| `adhd` | Goal anchoring for ADHD-impacted users — detect drift, externalize state, keep focus. |
| `critical-thinking` | Sycophancy resistance, evidence-driven evaluation, structured disagreement. |
| `token-rationalism` | Maximize value per token — do-it-now autonomy, code reusability, documentation skepticism. |

## integrations

| Skill | Description |
|-------|-------------|
| `github` | GitHub workflows with MCP or `gh` CLI fallback. |
| `gitlab` | GitLab workflows with MCP or `glab` CLI fallback. |
| `atlassian` | Jira & Confluence workflows with MCP or `acli` CLI fallback. |
| `deepwiki` | Analyze public GitHub repos via DeepWiki AI docs. Spawns background subagent — never blocks. |

## tools

| Skill | Description |
|-------|-------------|
| `claude-skills` | Install or refresh skills for Claude Code using `npx skills add`. |
| `gitlab-ci-local` | Test GitLab CI pipelines locally without pushing to GitLab. |
| `glab` | GitLab CLI automation with non-interactive mode (sets GLAB_NO_PROMPT=true). |

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

## skills

| Skill | Description |
|-------|-------------|
| `skills` | Install and manage agent skills using the `npx skills` CLI (vercel-labs/skills). |

## Add a skill

1. Create `<skill-name>/SKILL.md` directly under `.agents/skills/`.
2. Add YAML frontmatter: `name`, `description`, optional `version` and `prerequisites`.
3. Optional: add `assets/`, `references/`, or `scripts/` inside the skill folder.
4. Run `npx skills add . --all -y` to install updated skills.
5. Update this index.
