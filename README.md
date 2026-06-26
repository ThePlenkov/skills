# skills

Personal, agent-agnostic skills repository.

## Layout
- `.agents/agents/` contains role prompts.
- `.agents/skills/` contains all skills (each skill is a folder with `SKILL.md`).

## Quick start

### Install from this repo to your coding agents (remote install)

```bash
npx skills add ThePlenkov/skills --all
```

Or install to a specific agent:

```bash
npx skills add ThePlenkov/skills -a claude-code
npx skills add ThePlenkov/skills -a windsurf
```

Powered by the [`npx skills` CLI](https://github.com/vercel-labs/skills).

> **Note:** Always use the remote `ThePlenkov/skills` form above, or the symlink method below.
> The local dot-path form of this command has a known destructive bug that empties `SKILL.md`
> files in the source tree — do not use it on a local clone.

### Symlink install (local clone — recommended for contributors)

After cloning this repo, run once per machine:

```bash
bash scripts/install.sh
```

This creates `~/.agents/skills/personal → <repo>/.agents/skills/`.
Every skill you add to this repo is instantly available to all your agents — no re-run needed.

To verify:

```bash
bash scripts/install.sh --dry-run
```

## Creating a skill

1. Create a new folder under `.agents/skills/<skill-name>/`.
2. Add `SKILL.md` with YAML frontmatter (`name`, `description`).
3. Add `assets/`, `references/`, or `scripts/` only if needed.
4. Update `.agents/skills/README.md` with a short description.

## Dotfiles / Codespaces

This repository is self-installable as a
[GitHub Codespaces dotfiles](https://docs.github.com/en/codespaces/setting-your-user-preferences/personalizing-github-codespaces-for-your-account#dotfiles)
repository.

1. Go to **Settings → Codespaces → Dotfiles** on GitHub.
2. Select this repository and enable **Automatically install dotfiles**.

When a new codespace starts, `install.sh` runs automatically and creates the symlink
`~/.agents/skills/personal → <repo>/.agents/skills/`.

To re-run manually:

```bash
bash ~/dotfiles/scripts/install.sh
```

## Notes

- Keep skills agent-agnostic and avoid hardcoded absolute paths.
- Use project-relative paths when a default is needed (for example `./docs/planning`).
- Use `scripts/install.sh` for local installs — the remote CLI form is for consuming skills
  from other machines or agents.
