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

## Dotfiles / Codespaces

This repository is self-installable as a [GitHub Codespaces dotfiles](https://docs.github.com/en/codespaces/setting-your-user-preferences/personalizing-github-codespaces-for-your-account#dotfiles) repository.

1. Go to **Settings → Codespaces → Dotfiles** on GitHub.
2. Select this repository and enable **Automatically install dotfiles**.

When a new codespace starts, `install.sh` runs automatically and:
- Creates `~/.agents/skills.json` pointing to the cloned repo (non-destructive — skips if already present).
- Syncs all skills as symlinks into `~/.agents/skills/` (universal agent registry).
- Syncs all skills as symlinks into `~/.claude/skills/` (Claude Code).

To re-run manually: `bash ~/dotfiles/install.sh`

## Notes
- Keep skills agent-agnostic and avoid hardcoded absolute paths.
- Use project-relative paths when a default is needed (for example `./docs/planning`).
