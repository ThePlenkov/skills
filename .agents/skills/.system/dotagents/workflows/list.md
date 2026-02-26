# /dotagents list

Print the current `.agents/` framework setup — skills, agents, config.

## What to Show

### 1. Sync Config

Read and display `~/.agents/skills.json`:

```bash
cat ~/.agents/skills.json | jq .
```

### 2. Synced Skills

List all skills currently symlinked in `~/.agents/skills/`:

```bash
ls -la ~/.agents/skills/ | grep "^l"
```

### 3. Available Skills by Source

For each source in `skills.json`, list skills with their categories:

```bash
find <source>/.agents/skills -name "SKILL.md" -exec dirname {} \; | sort
```

### 4. Agent Installations

Check which agents have skills installed:

```bash
for dir in .windsurf .claude .codex .cursor .cagent; do
  [ -d "$dir" ] && echo "$dir: installed" || echo "$dir: not found"
done
```

### 5. Stale Symlinks

Check for broken symlinks:

```bash
find ~/.agents/skills -maxdepth 1 -type l ! -exec test -e {} \; -print
```

## Output

Present a clear summary. The agent should format this appropriately for its own output mechanism.
