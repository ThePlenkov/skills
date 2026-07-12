# AGENTS.md

This repository is maintained by an agent that creates and updates skills and role prompts.

## Layout

```
skills/
├── coaching/           # Agent coaching and user guidance
├── behavior/           # Evidence, code quality, critical thinking
├── methodology/        # Development methodologies (SDD, TDD, Agile)
├── orchestration/      # Subagent coordination and context management
├── planning/           # Planning, triage, session persistence
├── integrations/       # External tool integrations
├── testing/            # CI/CD testing and E2E scenarios
├── tools/              # Development tools and utilities
├── troubleshooting/    # Scoped descent, safety, recovery
├── experimentation/    # Sandboxed experimentation
├── git/                # Git workflow operations
├── code-review/        # PR/MR review and remediation
├── self-learning/      # Memory and retrospective learning
├── debt-management/    # Review debt collection
├── research/           # Research and documentation tools
└── agents/             # Agent configuration and management
```

- `skills/<category>/<skill-name>/` — each skill is a folder with `SKILL.md`.
- `.agents/agents/` — role prompts (tiered filenames only, role text without tiers).
- `.agents/commands/` — command definitions (e.g. `/drill`, `/undrill`, `/recall`, `/retain`, `/reflect`).
- `.agents/rules/` — agent behavior rules (e.g. `agent-memory.md`, `drill-troubleshooting.md`).
- `.memory/` — transient memory files (facts, experience, observations, mental-models).

## Repository rules

- Skills live in `skills/<category>/<skill-name>/`, NOT in `.agents/skills/`.
- Keep skills agent-agnostic.
- Avoid hardcoded absolute paths in skills or prompts.
- Use project-relative defaults when needed (for example `./docs/planning`).
- Keep prompts concise and focused on the role.

## Skill creation workflow

1. Pick a category under `skills/<category>/`.
2. Create a new skill folder: `skills/<category>/<skill-name>/`.
3. Add `SKILL.md` with a clear description and workflow.
4. Add `assets/`, `references/`, or `scripts/` only if needed.
5. Update the category description in `.claude-plugin/marketplace.json`.
6. Installation is automatic: `~/.agents/skills/personal` is a symlink
   to this repo's `skills/`, so every skill here is immediately
   available as `~/.agents/skills/personal/<category>/<name>`. Run
   `scripts/install.sh` once per machine to create that symlink (idempotent).
   Do NOT run `npx skills add . --all -y` — it has a destructive bug
   that empties `SKILL.md` files in the source tree.

## Skill references

When one skill references another, use `$skill{name}` notation:

```markdown
See $skill{evidence} for proof requirements.
Use $skill{safeguard} before destructive operations.
```

## Optional UI metadata

- Some skills may include `agents/openai.yaml` for UI metadata.
- This is optional and does not affect skill behavior.

## Role prompts

- Role prompts should reference `$subagents-setup` for hierarchy and delegation rules.
- Role prompts should reference `$shared-plan` for shared planning.
- Do not repeat the full system overview in each role prompt.

## Retrospect
## Command file syntax (Bob Shell)

Command files in `.agents/commands/` use YAML frontmatter. The `argument-hint` field must be a plain string without quotes or square brackets:

**❌ Wrong (causes validation error):**
```yaml
argument-hint: "--fix"                    # Quotes cause array interpretation
argument-hint: [--fix]                    # Square brackets are arrays
```

**✅ Correct:**
```yaml
argument-hint: --fix
argument-hint: --check --fix <subject>
argument-hint: pr|plan|backlog|harvest pr-number
```

Use plain text for optional arguments, `|` for alternatives, `<name>` for placeholders, and `--flag=value1|value2` for flag options.

- Use the $skill{retrospect} skill after mistakes or friction to capture learnings.
- It is secondary to an agent's own tools and memory.
