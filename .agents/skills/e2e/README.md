# e2e-agent (domain-agnostic)

Portable AI-native scenario runner. **No domain logic** — consumers provide `config.yaml` + adapter module.

| Doc | Audience |
| --- | -------- |
| [SPEC.md](./SPEC.md) | Framework contract (CLI, scenarios, adapter interface) |
| [SKILL.md](./SKILL.md) | Cursor/agent usage — **CLI commands only** |

```bash
bun .agents/skills/e2e/cli.ts list
bun .agents/skills/e2e/cli.ts run test-1 --config <project-config> --param value
```

Internal: `scripts/framework/` — not for agents.
