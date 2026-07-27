# skills

Personal, agent-agnostic skills repository.

## Dependency graph

Skills reference each other via `$skill{name}` (or bare `$name`) inside their
`SKILL.md` body. A global graph is unreadable at this scale (80 skills, ~140
edges), so the generator produces one focused subgraph per skill: the skill
itself plus its direct dependencies and direct dependents, grouped by
relationship. Hub skills with many neighbors are truncated (capped at 15 per side)
and clearly labelled.

**Browse:** [`docs/graphs/generated/index.md`](docs/graphs/generated/index.md) — gallery grouped by
category. Each row links to a `<skill>.md` with an embedded Mermaid block; on
github.com the diagram is interactive (click any node to zoom, drag to pan).

The path `docs/graphs/generated/` and the banner in every file mark these
documents as auto-generated. Do not edit them by hand — run `npm run graph`
(or `npm run graph:update`) after changing any `SKILL.md`.

**Regenerate locally:**

```bash
npm run graph          # writes docs/graphs/generated/<skill>.md + index.md + .build/skills-graph.json
npm run graph:update   # same defaults, explicit name

# Or invoke the generator directly for custom output paths:
npx tsx scripts/generate-skills-graph.ts --graph-dir docs/graphs/generated \
                                          --json .build/skills-graph.json \
                                          --neighbors 15

# If a typo or migration leaves unknown `$skill{...}` references, the
# generator exits 2 and prints the offenders. To regenerate anyway (e.g. in
# CI before the missing skill lands) pass --allow-unknown-refs.
```

Outputs land in `docs/graphs/generated/` (gitignored build output; github.com
renders Mermaid interactively) and `.build/skills-graph.json` (gitignored;
CI artifact). The generated gallery is pushed to `skills-sync/graphs/`.

**Regeneration check:** the [Skills Graph workflow](.github/workflows/skills-graph.yml)
runs on every push and PR touching skills or the generator to ensure the graph
generator still completes without errors. The rendered gallery is published to
`skills-sync/graphs/` rather than committed in this repository.

## Distribution mirror and Obsidian vault

The auto-generated distribution lives in
[`theplenkov-ai/skills-sync`](https://github.com/theplenkov-ai/skills-sync). It
is pushed by the
[`Sync skills to skills-sync`](.github/workflows/skills-sync.yml) workflow on
every push to `main`. Do not edit `skills-sync` directly — make changes here in
`skills/<category>/<skill-name>/SKILL.md` and let CI propagate them.

The mirror contains:

- `.agents/skills/` — flat skill tree for agent runtimes.
- `obsidian/` — an Obsidian vault with `[[wikilink]]`-resolved skill notes and a
  pre-filtered Graph view. Open `obsidian/` as a vault in Obsidian to explore
  skills and their connections without the large hub nodes from the generated
  Mermaid index.
- `README.md` — a generated skills index with per-category tables.

## Layout

```
skills/
├── agents/             # Framework management (dotagents, claude-skills)
├── behavior/           # Evidence, code quality, critical thinking
├── coaching/           # User guidance (adhd)
├── code-review/        # PR/MR review and remediation (act, triage-issue, etc.)
├── engineering/        # Cross-cutting engineering practices (API/UI design, performance, security)
├── experimentation/    # Sandboxed experimentation (sandboxed)
├── foundation/         # Always-on behavioral primitives (token economy, memory)
├── integrations/       # Platform connectors (GitHub, GitLab, Atlassian, Codacy, ...)
├── methodology/        # Development methodology (patching, critical thinking, code home, SDD)
├── orchestration/      # Agent coordination, isolation, and session state
├── research/           # Codebase analysis (deepwiki)
├── safety/             # Destructive operation protection (safeguard, salvage)
├── self-learning/      # Retrospective learning (retrospect, skill-feedback)
├── tools/              # Dev tools (skillmaker, skills-cli, docker-agent-config, ...)
├── troubleshooting/    # Scoped descent, safety, recovery
├── verification/       # Runtime proof (evidence)
└── workflow/           # Development workflow (git, testing, planning, debt)
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

**Available plugins:** `skills` (all), `coaching`, `behavior`, `foundation`, `methodology`, `verification`, `orchestration`, `workflow`, `integrations`, `tools`, `safety`, `experimentation`, `engineering`, `troubleshooting`, `code-review`, `self-learning`, `research`, `agents`

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
