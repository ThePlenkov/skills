# skills

Personal, agent-agnostic skills repository.

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

Each category contains skill directories with `SKILL.md` files.

## Quick start

### Install all skills (remote)

```bash
npx skills add ThePlenkov/skills --all
```

Or install to a specific agent:

```bash
npx skills add ThePlenkov/skills -a claude-code
npx skills add ThePlenkov/skills -a windsurf
```

Powered by the [`npx skills` CLI](https://github.com/vercel-labs/skills).

### Install specific categories

```bash
npx skills add ThePlenkov/skills --skill behavior
npx skills add ThePlenkov/skills --skill methodology --skill orchestration
```

### Claude Code plugin marketplace

This repo is also a [Claude Code plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces).

**Install all skills:**
```
/plugin marketplace add ThePlenkov/skills
/plugin install skills@theplenkov-claude
```

**Install a specific category:**
```
/plugin marketplace add ThePlenkov/skills
/plugin install behavior@theplenkov-claude
/plugin install methodology@theplenkov-claude
```

**Available plugins:** `skills` (all), `coaching`, `behavior`, `methodology`, `orchestration`, `planning`, `integrations`, `testing`, `tools`, `troubleshooting`, `experimentation`, `git`, `code-review`, `self-learning`, `debt-management`, `research`, `agents`

**Auto-populate for your team** — add to `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "theplenkov-claude": {
      "source": {
        "source": "github",
        "repo": "ThePlenkov/skills"
      }
    }
  }
}
```

### Symlink install (local clone — recommended for contributors)

After cloning this repo, run once per machine:

```bash
bash scripts/install.sh
```

This creates `.agents/skills/<skill-name>` symlinks pointing to `skills/<category>/<skill-name>/` (categories may be nested).
Re-run `scripts/install.sh` after adding or removing skills to update the symlinks.

To verify:

```bash
bash scripts/install.sh --dry-run
```

## Creating a skill

1. Pick a category under `skills/<category>/` (categories may be nested).
2. Create a new folder: `skills/<category>/<skill-name>/`.
3. Add `SKILL.md` with YAML frontmatter (`name`, `description`).
4. Add `assets/`, `references/`, or `scripts/` only if needed.
5. Update the category description in `.claude-plugin/marketplace.json`.

## Skill references

When one skill references another, use `$skill{name}` notation:

```markdown
See $skill{evidence} for proof requirements.
Use $skill{safeguard} before destructive operations.
```

## Dotfiles / Codespaces

This repository is self-installable as a
[GitHub Codespaces dotfiles](https://docs.github.com/en/codespaces/setting-your-user-preferences/personalizing-github-codespaces-for-your-account#dotfiles)
repository.

1. Go to **Settings → Codespaces → Dotfiles** on GitHub.
2. Select this repository and enable **Automatically install dotfiles**.

When a new codespace starts, `install.sh` runs automatically and creates flat
`~/.agents/skills/<skill-name>` symlinks pointing to the `skills/` directory in this repo.
Re-run `install.sh` after pulling new skills to create their symlinks.

To re-run manually:

```bash
bash ~/dotfiles/install.sh
```

## Notes

- Keep skills agent-agnostic and avoid hardcoded absolute paths.
- Use project-relative paths when a default is needed (for example `./docs/planning`).
- Use `scripts/install.sh` for local installs — the remote CLI form is for consuming skills
  from other machines or agents.
