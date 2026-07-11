# /dotagents list

Print the current `.agents/` framework setup — skills, agents, config.

## What to Show

### 1. Installed Skills

List all skills installed via `npx skills`:

```bash
npx skills list
```

### 2. Available Skills in This Repo

List skills available in the current project:

```bash
npx skills add . --list
```

Or find them directly:

```bash
find .agents/skills -name "SKILL.md" -exec dirname {} \; | sort
```

### 3. Agent Installations

Check which agents have skills installed:

```bash
for dir in .windsurf .claude .codex .cursor .agents; do
  [ -d "$dir/skills" ] && echo "$dir/skills: installed" || echo "$dir/skills: not found"
done
```

### 4. Check for Updates

```bash
npx skills check
```

## Output

Present a clear summary. The agent should format this appropriately for its own output mechanism.
