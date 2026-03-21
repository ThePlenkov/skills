# AGENTS.md

This repository is maintained by an agent that creates and updates skills and role prompts.

## Layout
- `.agents/agents/` role prompts (tiered filenames only, role text without tiers).
- `.agents/skills/` skills (each skill is a folder with `SKILL.md`).

## Repository rules
- Do not create new top-level folders under `.agents/` besides `agents/` and `skills/`.
- Keep skills agent-agnostic.
- Avoid hardcoded absolute paths in skills or prompts.
- Use project-relative defaults when needed (for example `./docs/planning`).
- Keep prompts concise and focused on the role.

## Skill creation workflow
1. Create a new skill folder under `.agents/skills/<category>/<skill-name>/`.
2. Add `SKILL.md` with a clear description and workflow.
3. Add `assets/`, `references/`, or `scripts/` only if needed.
4. Update `.agents/skills/README.md` with a short description.
5. Run `npx skills add . --all -y` to install updated skills to all agents.

## Optional UI metadata
- Some skills may include `agents/openai.yaml` for UI metadata.
- This is optional and does not affect skill behavior.

## Role prompts
- Role prompts should reference `$subagents-setup` for hierarchy and delegation rules.
- Role prompts should reference `$shared-plan` for shared planning.
- Do not repeat the full system overview in each role prompt.

## Retrospect
- Use the `retrospect` skill after mistakes or friction to capture learnings.
- It is secondary to an agent’s own tools and memory.
