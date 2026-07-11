# Skills Index

This folder contains agent-agnostic, generic skills (no company-specific content).
Skills live directly under `.agents/skills/<skill-name>/`.

## Skills

|| Skill | Description |
||-------|-------------|
|| `act` | Resolve review threads in product code (or post a substantive in-thread reply), commit, then close. Use `/act <context>` where context ∈ {`pr`, `plan`, `backlog`, `harvest`}. |
|| `adhd` | Goal anchoring for ADHD-impacted users — detect drift, externalize state, keep focus. |
|| `atlassian` | Jira & Confluence workflows with MCP or `acli` CLI fallback. |
|| `backlog` | Actionable improvement items derived from experience and retrospectives. Items live in `.agents/backlog/`. |
|| `claude-skills` | Install or refresh skills for Claude Code using `npx skills add`. |
|| `codacy` | Codacy static analysis — reproduce findings locally, debug "N issues (0 max.)" failures, work with Codacy CLI / GitHub annotations API / org secrets. |
|| `codehome` | Detect and fix code that lives in the wrong architectural layer, file, or configuration surface. |
|| `codescene` | CodeScene setup and usage — CI delta analysis, local CLI, CS_ACCESS_TOKEN, Docker image, troubleshooting 403s and secret visibility. |
|| `critical-thinking` | Sycophancy resistance, evidence-driven evaluation, structured disagreement. |
|| `deepwiki` | Analyze public GitHub repos via DeepWiki AI docs. Spawns background subagent — never blocks. |
|| `dotagents` | Framework lifecycle: `/dotagents init`, `install`, `list`. Includes skill philosophy and subagent hierarchy. |
|| `docker-agent` | Design, configure, and run multi-agent AI teams using Docker Agent's YAML/HCL config format (`docker agent` CLI plugin). Covers agents, models, toolsets (filesystem, shell, MCP, LSP, fetch, openapi, memory, think, todo, api, a2a), sub-agent delegation, OCI distribution, and the full CLI surface. |
|| `e2e` | Domain-agnostic AI-native scenario runner (e2e-agent CLI). Scenarios are markdown prompts; evidence written by the CLI. Use `/e2e` for live scenario tests. |
|| `evidence` | Producer-side "say-nothing-without-a-run" discipline. ANY claim of done/fixed/passing/verified/green by a coder agent MUST be backed by a real executed command + matching `.evidence/.../claim.json` on disk. JSON-Schema enforces: empty `commands` or `assertions` is invalid; browser claims without screenshot/trace are invalid; static-analysis claims without a "0 errors" quote are invalid. Pairs with `runtime-proof` (method) and the `verifier` agent (independent re-check). |
|| `git-commit` | Structured git commit workflow with message conventions. |
|| `github` | GitHub workflows with MCP or `gh` CLI fallback. |
|| `github-pr-review` | Write a code review for a GitHub PR — context → diff → prioritised findings → post back via `gh`. |
|| `github-fix-main` | Autopilot: heal the default branch end-to-end — fix latest red CI run + code-scanning alerts + AI/Sonar findings, open one PR with atomic per-category commits, then poll CI + review threads until green & cleared. No mid-flow prompts. |
|| `gitlab` | GitLab workflows with MCP or `glab` CLI fallback. |
|| `gitlab-ci-local` | Test GitLab CI pipelines locally without pushing to GitLab. |
|| `glab` | GitLab CLI automation with non-interactive mode (sets GLAB_NO_PROMPT=true). |
|| `glean` | Glean CLI via glean-bk wrapper with automatic OAuth token sync from bk CLI. |
|| `harvest` | Collect unresolved PR review threads into `.agents/review-debt/harvests/*.jsonl` on PR merge. One-way: collects, never fixes. |
|| `investigate-first` | Inspect, search, and reproduce before any patch. Prevents chaotic edits. |
|| `memory` | Persistent memory enforcement — recall before acting, persist after learning. |
|| `memory-bank` | Unified agent memory — facts, experience, observations, mental-models under `.memory/`. Use `/remember <type> — <content>`. |
|| `minimal-root-cause` | Climb the laziness ladder before editing — avoid overengineering and symptom patches. |
|| `mr-address-review` | End-to-end GitLab MR review-comment remediation — acknowledge, fix, verify, commit, push, reply, react, and resolve discussions. |
|| `npm-publish` | Publish npm packages with granular tokens or OIDC trusted publishing. Includes `prepare-ci` to bootstrap CI publishing for new packages. |
|| `one-shot-patch` | Make exactly one narrow change, then verify it. Prevents stacked fixes, broad refactors, and chaotic iteration. |
|| `retrospect` | Self-correction protocol — persist fixes that prevent recurrence. |
|| `sarif-to-annotations` | Convert SARIF 2.1.0 reports to GitHub Actions workflow-command annotations. Reusable for any tool that emits SARIF (CodeQL, Snyk, ESLint, etc.) when inline PR annotations are needed. |
|| `runtime-proof` | Prove actual behavior in the target runtime before final completion. Required for HTML, UI, browser JavaScript, hydration, routing, and client-side behavior where curl is not enough. |
|| `safeguard` | Prevent destructive agent actions from deleting user work, untracked files, experimental code, or recoverable evidence. |
|| `salvage` | Emergency recovery mode after accidental deletion, `git clean`, `git restore`, reset, overwrite, or destructive agent action. |
|| `sandbox` | Isolate risky agent experiments in a dedicated git branch or git worktree, create explicit checkpoint commits, and prevent the agent from breaking the user's active working directory. |
|| `save-session` | Perform a durable end-of-work save across code, plans, memory, and documentation. |
|| `shared-plan` | Shared planning and coordination across agents. |
|| `skills` | Install and manage agent skills using the `npx skills` CLI (vercel-labs/skills). |
|| `spec-kit` | Spec-Driven Development with GitHub Spec Kit. |
|| `subagent-capsule` | Build a complete context capsule before launching any subagent. |
|| `tcc-support-bot` | TCC_Support_Bot in #gitlab for GitLab project operations (archive, move, delete). |
|| `token-rationalism` | Maximize value per token — do-it-now autonomy, code reusability, documentation skepticism. |
|| `triage-issue` | End-to-end triage of a GitLab/GitHub issue — acknowledge, investigate, fix-or-retest, verify, report back on the issue. |
|| `unwind` | Collapse a solved subtask into the parent plan and continue automatically. |

## Add a skill

1. Create `<skill-name>/SKILL.md` directly under `.agents/skills/`.
2. Add YAML frontmatter: `name` and `description` (the only spec-compliant fields).
3. Optional: add `assets/`, `references/`, or `scripts/` inside the skill folder.
4. No install step needed locally — `scripts/install.sh` exposes every skill here
   under the per-user personal-skills symlink (see `AGENTS.md` for the path and
   `scripts/install.sh` for how it is created). Do NOT run
   `npx skills add . --all -y` inside this repo — it has a destructive bug that
   empties `SKILL.md` files in the source tree.
5. Update this index.