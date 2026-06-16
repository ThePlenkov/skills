# Skills Index

This folder contains agent-agnostic, generic skills (no company-specific content).
Skills live directly under `.agents/skills/<skill-name>/`.

## Skills

|| Skill | Description |
||-------|-------------|
|| `adhd` | Goal anchoring for ADHD-impacted users — detect drift, externalize state, keep focus. |
|| `atlassian` | Jira & Confluence workflows with MCP or `acli` CLI fallback. |
|| `claude-skills` | Install or refresh skills for Claude Code using `npx skills add`. |
|| `critical-thinking` | Sycophancy resistance, evidence-driven evaluation, structured disagreement. |
|| `deepwiki` | Analyze public GitHub repos via DeepWiki AI docs. Spawns background subagent — never blocks. |
|| `dotagents` | Framework lifecycle: `/dotagents init`, `install`, `list`. Includes skill philosophy and subagent hierarchy. |
|| `git-commit` | Structured git commit workflow with message conventions. |
|| `github` | GitHub workflows with MCP or `gh` CLI fallback. |
|| `github-pr-review` | Write a code review for a GitHub PR — context → diff → prioritised findings → post back via `gh`. |
|| `github-fix-main` | Autopilot: heal the default branch end-to-end — fix latest red CI run + code-scanning alerts + AI/Sonar findings, open one PR with atomic per-category commits, then poll CI + review threads until green & cleared. No mid-flow prompts. |
|| `gitlab` | GitLab workflows with MCP or `glab` CLI fallback. |
|| `gitlab-ci-local` | Test GitLab CI pipelines locally without pushing to GitLab. |
|| `glab` | GitLab CLI automation with non-interactive mode (sets GLAB_NO_PROMPT=true). |
|| `glean` | Glean CLI via glean-bk wrapper with automatic OAuth token sync from bk CLI. |
|| `memory` | Persistent memory enforcement — recall before acting, persist after learning. |
|| `mr-address-review` | End-to-end GitLab MR review-comment remediation — acknowledge, fix, verify, commit, push, reply, react, and resolve discussions. |
|| `retrospect` | Self-correction protocol — persist fixes that prevent recurrence. |
|| `shared-plan` | Shared planning and coordination across agents. |
|| `npm-publish` | Publish npm packages with granular tokens or OIDC trusted publishing. Includes `prepare-ci` to bootstrap CI publishing for new packages. |
|| `skills` | Install and manage agent skills using the `npx skills` CLI (vercel-labs/skills). |
|| `spec-kit` | Spec-Driven Development with GitHub Spec Kit. |
|| `tcc-support-bot` | TCC_Support_Bot in #gitlab for GitLab project operations (archive, move, delete). |
|| `token-rationalism` | Maximize value per token — do-it-now autonomy, code reusability, documentation skepticism. |
|| `triage-issue` | End-to-end triage of a GitLab/GitHub issue — acknowledge, investigate, fix-or-retest, verify, report back on the issue. |

## Add a skill

1. Create `<skill-name>/SKILL.md` directly under `.agents/skills/`.
2. Add YAML frontmatter: `name` and `description` (the only spec-compliant fields).
3. Optional: add `assets/`, `references/`, or `scripts/` inside the skill folder.
4. Run `npx skills add . --all -y` to install updated skills.
5. Update this index.
