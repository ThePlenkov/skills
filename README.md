# ThePlenkov/skills

Public distribution of agent skills from [theplenkov-ai/skills](https://github.com/theplenkov-ai/skills).

## Install

```bash
# Install all skills
npx skills add ThePlenkov/skills --all

# Install a specific skill
npx skills add ThePlenkov/skills --skill <skill-name>
```

## Skills

| Skill | Description |
|---|---|
| act | Use when the user invokes /act on a PR/MR, /act with no arguments (uses the PR in the current conversation context), or /act <context> with context ∈ {pr, plan, backlog, harvest, stack}. Resolves threads in product code (or posts a substantive in-thread reply), commits, then closes threads. Never resolve-only. Harvest (collecting threads) lives in /harvest; triage (priority / grouping / wontfix) lives in /backlog. /act is the fix loop, not the collect or triage. |
| drill | Scoped descent primitive for agent systems. Creates isolated execution frames, materializes them as directory trees, and returns a result plus a parallel prevention plan so the same problem does not recur. |

_Auto-published from [theplenkov-ai/skills](https://github.com/theplenkov-ai/skills)._
