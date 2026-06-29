# /dotagents sync

Install or update skills from one or more remote repositories using `npx skills`.

> Scope: opt-in per user invocation. This workflow **only runs when the user explicitly invokes** `/dotagents sync`; never automatically. Each invocation prompts the user before pulling new skill content or changing agent configuration.

## Sync with `npx skills`

Use the [`npx skills` CLI](https://github.com/vercel-labs/skills) to install or update skills from a repository:

```bash
# Install all skills from a repo to all detected agents
npx skills add ThePlenkov/skills --all -y

# Install from multiple repos
npx skills add ThePlenkov/skills --all -y
npx skills add other-owner/other-skills --all -y

# Install to specific agents only
npx skills add ThePlenkov/skills -a claude-code -a windsurf -y

# Check for updates across all installed skills
npx skills check

# Update all installed skills to latest versions
npx skills update
```

## Source Formats

```bash
# GitHub shorthand
npx skills add owner/repo

# Full GitHub URL
npx skills add https://github.com/owner/repo

# Local clone
npx skills add /path/to/skills-repo

# Current project
npx skills add .
```

## Behavior

- **Idempotent**: Safe to run multiple times
- **No manual symlinks**: The CLI manages all agent paths automatically
- **Auto-detection**: Detects which coding agents are installed

## Troubleshooting

- **`npx: command not found`** — Install Node.js: `apt install nodejs npm` or `brew install node`
- **Permission errors** — Ensure write access to the target agent directory
- **Skill not loading** — Verify `SKILL.md` has valid `name` and `description` frontmatter
