# AGENTS.md

This repository is maintained by an agent that creates and updates skills and role prompts.

## Layout

```
skills/
├── foundation/         # Always-on behavioral primitives (token economy, memory)
├── methodology/        # Development methodology (patching, critical thinking, code home, SDD)
├── verification/       # Runtime proof (evidence)
├── safety/             # Destructive operation protection (safeguard, salvage)
├── orchestration/      # Agent coordination, isolation, and session state
├── workflow/           # Development workflow (git, testing, planning, debt)
│   ├── git/                # commit, push, reset
│   ├── testing/            # ci-local, e2e
│   ├── planning/           # shared-plan, backlog
│   └── debt/               # harvest
├── code-review/        # PR/MR review and remediation (act, triage-issue, etc.)
├── integrations/       # Platform connectors (GitHub, GitLab, Atlassian, Codacy, ...)
├── tools/              # Dev tools (skillmaker, skills-cli, docker-agent-config, ...)
├── research/           # Codebase analysis (deepwiki)
├── coaching/           # User guidance (adhd)
├── self-learning/      # Retrospective learning (retrospect, skill-feedback)
├── experimentation/    # Sandboxed experimentation (sandboxed)
└── agents/             # Framework management (dotagents, claude-skills)
```

- `skills/<category>/<skill-name>/` — each skill is a folder with `SKILL.md` (categories may be nested).
- `.agents/skills/<skill-name>/` — generated flat symlinks to `skills/<category>/<skill-name>/`.
- `.claude-plugin/plugin.json` — Claude Code plugin manifest (identity metadata).
- `.claude-plugin/marketplace.json` — Claude Code plugin marketplace catalog (category-to-skills mapping).
- `.claude-plugin/skills-index.json` — generated machine-readable index for lazy loading at scale. It is built as a CI artifact by the `Skills Index` workflow and is not committed to the repository.
- `.claude-plugin/skills-index.schema.json` — JSON Schema for the index (validated with jsonschema in `scripts/validate-skills-index.sh`).
- `.codex-plugin/plugin.json` — ChatGPT/Codex plugin manifest. Same skills, different plugin format.
- `.agents/plugins/marketplace.json` — ChatGPT/Codex plugin marketplace catalog (Codex-format entries for the Plugins Directory).
- `.agents/agents/` — role prompts (tiered filenames only, role text without tiers).
- `.agents/commands/` — command definitions (e.g. `/drill`, `/undrill`, `/recall`, `/retain`, `/reflect`).
- `.agents/rules/` — agent behavior rules (e.g. `agent-memory.md`, `drill-troubleshooting.md`).
- `.memory/` — transient memory files (facts, experience, observations, mental-models).

## Repository rules

- Skills live in `skills/<category>/<skill-name>/` (categories may be nested). `.agents/skills/<skill-name>/` is a generated flat symlink view, not the source.
- Keep skills agent-agnostic.
- Keep skills OS-independent: commands and scripts must work on Linux, macOS, and Windows. See `.agents/rules/os-independent.md`.
- Avoid hardcoded absolute paths in skills or prompts.
- Use project-relative defaults when needed (for example `./docs/planning`).
- Keep prompts concise and focused on the role.
- A skill that documents a specific external tool (one CLI / one service with its own upstream repo) lives **in that tool's repo**, not here. This repo only carries generic methodology, foundation, safety, verification, and agent-agnostic tooling. Examples: `gh-stackx` lives in `ThePlenkov/gh-stackx`, not here.

## External skills (installed via `npx skills`)

Some skills are owned by other repos and pulled into `.agents/skills/` at install time via `npx skills add <owner>/<repo> --skill <name>`. They are tracked by `skills-lock.json` at the repo root and **must be committed** so every contributor and CI gets the same set.

- Install: `npx skills add <owner>/<repo> --skill <name> -y`
- Update: `npx skills update`
- Remove: `npx skills remove <name>`

`scripts/install.sh` reads `skills-lock.json` (via `jq`) and preserves any entry whose `sourceType` is not `"local"` when regenerating `.agents/skills/`. Local-repo entries (e.g. from `npx skills add .`) are still validated against `skills/`. Do not manually edit `skills-lock.json` — it is machine-managed.

## Skill creation workflow

1. Pick a category under `skills/<category>/` (categories may be nested).
2. Create a new skill folder: `skills/<category>/<skill-name>/`.
3. Add `SKILL.md` with a clear description and workflow.
4. Add `assets/`, `references/`, or `scripts/` only if needed.
5. Update the category description in `.claude-plugin/marketplace.json` (Claude Code) and add a plugin entry in `.agents/plugins/marketplace.json` (ChatGPT/Codex).
6. Declare the skill's upstream `source:` in its SKILL.md frontmatter
   (see [Skill source metadata](#skill-source-metadata) below). This is what
   `$skill{skill-feedback}` targets when a finding should flow back to the canonical
   maintainer.
7. `.agents/skills/` is generated by `npm run install:skills` as a flat directory
   of symlinks (`<skill-name>/` → `skills/<category>/<skill-name>/`). Run
   `npm run install:skills` to create or refresh it (idempotent). The CI check
   `dotagents-skills` verifies it stays in sync.
   Do NOT run `npx skills add . --all -y` — it has a destructive bug
   that empties `SKILL.md` files in the source tree.
8. `.claude-plugin/skills-index.json` is generated by
   `scripts/generate-skills-index.ts` and verified by
   `scripts/validate-skills-index.sh`. The generator also produces
   `.claude-plugin/skills-index.schema.json` from the same TypeScript/Zod
   types. The validator checks the generated index against the generated schema
   (using jsonschema when available) and ignores the volatile `generated_at`
   field. The index and schema are built as CI artifacts by the `Skills Index`
   workflow and are not committed. Because this repository is private, the
   artifacts are not deployed to GitHub Pages; they are published as a workflow
   artifact named `skills-index`. Consumers with repository access can download
   the latest files with:
   `gh run download -R ThePlenkov/skills -n skills-index`
   Run `scripts/validate-skills-index.sh --update` locally to produce them for
   testing; `npm install` is required first.

## Skill source metadata

Every `SKILL.md` frontmatter **must** declare where the skill's canonical source
lives so that `$skill{skill-feedback}` and other tools can route findings upstream
without hard-coding the repo per skill.

```yaml
---
name: my-skill
description: ...
source: ThePlenkov/skills
---
```

- **Format**: `<owner>/<repo>` (GitHub shorthand). Accepted directly by `gh`.
- **Default**: `ThePlenkov/skills`. Set explicitly on every skill — do not rely
  on a fallback in tools, so the source is greppable.
- **Path inside the repo is derived** from the on-disk location
  (`skills/<category>/<skill-name>/`). Do not encode the path in `source:`.
- **Forks**: set `source:` to the fork's `<owner>/<repo>`. The feedback skill
  reads `source:` at runtime, so fork maintainers can route feedback to
  themselves without touching the skill body.
- **Optional override fields** (use only when genuinely needed): not defined yet.
  Add them via a separate proposal rather than overloading `source:`.

## Skill references

When one skill references another, use `$name` or `$skill{name}` notation. Integration and tool skills are typically referenced by bare `$name` (e.g. `$github`, `$gitlab`, `$glab`); other skills may use `$skill{name}`:

```markdown
See $skill{evidence} for proof requirements.
Use $skill{safeguard} before destructive operations.
See $github for authentication.
```

## Optional UI metadata

- Some skills may include `agents/openai.yaml` for UI metadata.
- This is optional and does not affect skill behavior.

## Role prompts

- Role prompts should reference `$subagents-setup` for hierarchy and delegation rules.
- Role prompts should reference `$shared-plan` for shared planning.
- Do not repeat the full system overview in each role prompt.

## Retrospect

- Use the $skill{retrospect} skill after mistakes or friction to capture learnings.
- It is secondary to an agent's own tools and memory.

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
