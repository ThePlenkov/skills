# skills

Personal, agent-agnostic skills repository.

## Layout
- `.agents/agents/` contains role prompts (tiered filenames like `l0-manager.md`).
- `.agents/skills/` contains all skills.

## Quick start
1. Create a new folder under `.agents/skills/<skill-name>/`.
2. Add `SKILL.md` with a clear description and workflow.
3. Add `assets/`, `references/`, or `scripts/` only if needed.
4. Update `.agents/skills/README.md` with the new skill.

## Notes
- Keep skills agent-agnostic and avoid hardcoded absolute paths.
- Use project-relative paths when a default is needed (for example `./docs/planning`).
