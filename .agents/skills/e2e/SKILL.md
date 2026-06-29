---
name: e2e
description: >-
  Domain-agnostic AI-native scenario runner (e2e-agent CLI). Scenarios are markdown prompts;
  evidence is written by the CLI. Use when the user invokes /e2e or asks to run a live scenario
  test and collect evidence under .e2e/results/. Agents use only e2e-agent commands — never
  import internal framework modules.
---

# /e2e — e2e-agent (domain-agnostic)

**This skill is fully generic.** It does not know SAP, MCP, or any particular service. Your project supplies a config + adapter; see [SPEC.md](./SPEC.md).

**Agents use only the CLI below.** Do not import `scripts/framework/*`. Do not generate per-scenario TypeScript.

## Commands

```bash
e2e-agent list [--config <path>] [suite]
e2e-agent show <code> --config <path>
e2e-agent run <code> --config <path> [--param value ...]
e2e-agent dispatch <code> --config <path> --acp --agent <acp-id> [--param value ...]
e2e-agent help
```

Config defaults via `E2E_CONFIG` or `e2e.config.yaml` at repo root when omitted.

### OpenADT (this repo)

```bash
bun run e2e -- list
bun run e2e -- show ls-1
bun run e2e -- run ls-1 --destination ABC
bun run e2e -- run mcp-1 --destination ABC
```

Project profile: `e2e.config.yaml`. Product spec: `specs/mcp-ai-testing.md`.

## On `/e2e <code> [params]`

1. Map user params to CLI flags (e.g. `--destination ABC` or full `ABC_200_USER_EN`).
2. Run `e2e-agent run <code> --config <project-config> …` (or `dispatch` with `--acp`).
3. Read stdout: exit code, `E2E_EVIDENCE_FILE=…`.
4. Report PASS/FAIL, Given/When/Then summary, assertion highlights from evidence.

| User intent | Command |
| ----------- | ------- |
| Run locally (default) | `e2e-agent run …` |
| Delegate (no local service spawn) | `e2e-agent dispatch … --acp --agent <id>` |

## Report to user

**Local run:** PASS/FAIL, evidence path, Given/When/Then, per-step assertion table (quote failures with expected vs actual).

**ACP dispatch:** `E2E_DISPATCH_FILE`, target agent, pasteable prompt and `command.local`. Do not claim PASS/FAIL until external agent returns evidence.

## Configuration

Project config lives in `e2e.config.yaml` at the repo root (adapter, suites, optional `autoclean`). See [SPEC.md](./SPEC.md) for framework flags, scenario format, adapter contract, and evidence shape.
