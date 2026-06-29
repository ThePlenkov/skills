# skills

Personal, agent-agnostic skills repository.

## Layout
- `.agents/agents/` contains role prompts (one folder per role, e.g. `investigator/`, `patcher/`, `verifier/`).
- `.agents/skills/` contains all skills.

## Quick start

Install all skills from this repo to all your coding agents:

```bash
npx skills add ThePlenkov/skills --all
```

Or install to a specific agent:

```bash
npx skills add ThePlenkov/skills -a claude-code
npx skills add ThePlenkov/skills -a windsurf
```

Powered by the [`npx skills` CLI](https://github.com/vercel-labs/skills).

## Creating a skill
1. Create a new folder under `.agents/skills/<skill-name>/`.
2. Add `SKILL.md` with a clear description and workflow.
3. Add `assets/`, `references/`, or `scripts/` only if needed.
4. Update `.agents/skills/README.md` with the new skill.

## Dotfiles / Codespaces

This repository is self-installable as a [GitHub Codespaces dotfiles](https://docs.github.com/en/codespaces/setting-your-user-preferences/personalizing-github-codespaces-for-your-account#dotfiles) repository.

1. Go to **Settings → Codespaces → Dotfiles** on GitHub.
2. Select this repository and enable **Automatically install dotfiles**.

When a new codespace starts, `install.sh` runs automatically and creates the
`~/.agents/skills/personal` symlink exposing every skill under `.agents/skills/`.
No re-install is needed when skills are added or updated.

To re-run manually: `bash ~/dotfiles/install.sh`

## Notes
- Keep skills agent-agnostic and avoid hardcoded absolute paths.
- Use project-relative paths when a default is needed (for example `./docs/planning`).
