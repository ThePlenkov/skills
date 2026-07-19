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

### Direct install via npx/bunx/pnpm

Install skills directly from GitHub without the `skills` CLI.

> Requires Node.js ≥22.6 on the caller's machine (the wrapper is a TypeScript
> file run via Node's `--experimental-strip-types`).

```bash
# Install to ~/.agents/skills/ (default, copy mode)
npx github:theplenkov/skills

# Install to current project's ./.agents/skills/
npx github:theplenkov/skills --project

# Preview what would be installed
npx github:theplenkov/skills --dry-run

# Verify an existing copy-mode install is in sync (non-zero exit if not)
npx github:theplenkov/skills --check

# Permit install.sh to clobber foreign entries in the target that don't
# already match a current skill (e.g. files the user dropped into
# ~/.agents/skills). Without --force, install.sh refuses to delete them.
npx github:theplenkov/skills --force

# Stable local checkout: symlink mode into an explicit target (recommended
# over --copy because the source tree is persistent).
npx github:theplenkov/skills --no-copy --target=$PWD/.agents/skills
```

Two install flows live side-by-side in this repo:

| Flow | Source | Target layout | Default runner |
| --- | --- | --- | --- |
| Symlink-based | `./scripts/install.sh` (and `npx skills add`) | `~/.agents/skills/<skill>` symlinks into the repo checkout | Local clone, source tree is persistent |
| Copy-based | `bin/skills.ts` via `npx github:theplenkov/skills` | `~/.agents/skills/<skill>` directories vendored into place | `npx`/`bunx`/`pnpm dlx` (transient cache) |

Copy mode is the wrapper default because `npx github:theplenkov/skills`
extracts the repo into a runner cache that may be pruned; symlinks would
dangle once the cache is gone. For anything else, use the symlink flow
directly via the `./scripts/install.sh --home` path or by passing
`--no-copy` to the wrapper.

```bash
# Both runners end up at ~/.agents/skills/<skill-name>
npx github:theplenkov/skills     # copies
npx github:theplenkov/skills --no-copy --target=$HOME/.agents/skills  # symlinks
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

### ChatGPT / Codex plugin marketplace

This repo also supports [ChatGPT/Codex plugins](https://learn.chatgpt.com/docs/build-plugins).

**Add the marketplace from the CLI:**
```
codex plugin marketplace add ThePlenkov/skills
```

**Or add manually** — add to your repo's `.agents/plugins/marketplace.json`:
```json
{
  "name": "theplenkov-skills",
  "interface": { "displayName": "Plenkov Skills" },
  "plugins": [
    {
      "name": "skills",
      "source": { "source": "git-subdir", "url": "https://github.com/ThePlenkov/skills.git", "path": "./", "ref": "main" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

Then restart the ChatGPT desktop app and install from the Plugins Directory.

### Symlink install (local clone — recommended for contributors)

After cloning this repo, run once per machine:

```bash
npm run install:skills
```

This creates `.agents/skills/<skill-name>` symlinks pointing to `skills/<category>/<skill-name>/` (categories may be nested).
Re-run `npm run install:skills` after adding or removing skills to update the links.

To verify:

```bash
npm run install:skills -- --dry-run
```

## Creating a skill

1. Pick a category under `skills/<category>/` (categories may be nested).
2. Create a new folder: `skills/<category>/<skill-name>/`.
3. Add `SKILL.md` with YAML frontmatter (`name`, `description`).
4. Add `assets/`, `references/`, or `scripts/` only if needed.
5. Update the category description in `.claude-plugin/marketplace.json` (Claude Code) and add a plugin entry in `.agents/plugins/marketplace.json` (ChatGPT/Codex).

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
Re-run `npx tsx scripts/run.ts scripts/install.sh --home` after pulling new skills to update the links.

## Notes

- Keep skills agent-agnostic and avoid hardcoded absolute paths.
- Keep skills OS-independent: commands and scripts must work on Linux, macOS, and Windows. See `.agents/rules/os-independent.md`.
- Use project-relative paths when a default is needed (for example `./docs/planning`).
- Use `npm run install:skills` for local installs — the remote CLI form is for consuming skills
  from other machines or agents.
