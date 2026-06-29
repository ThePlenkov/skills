# e2e-agent — framework specification

**Domain-agnostic.** This package has no knowledge of SAP, MCP, HTTP APIs, or any particular service. Consumers provide a **project config** and **adapter** plugin.

## Public surface

Agents and operators use **only** the `e2e-agent` CLI (or `bun run e2e` alias in a consuming repo). Internal modules under `scripts/framework/` are not part of the agent contract.

```bash
e2e-agent list [--config <path>] [suite]
e2e-agent show <code> --config <path>
e2e-agent run <code> --config <path> [--param value ...] [--evidence] [--agent <id>] [--model <id>]
e2e-agent dispatch <code> --config <path> [--param value ...] --acp --agent <acp-id>
e2e-agent help
```

### Config resolution (first wins)

1. `--config <path>`
2. `E2E_CONFIG` environment variable
3. `e2e.config.yaml` at repo root (default)

### Framework CLI flags

| Flag | Meaning |
| ---- | ------- |
| `--config` | Project profile YAML (required unless defaulted) |
| `--evidence` | Write `.e2e/results/<run>.md` (on by default for `run`) |
| `--evidence-dir` | Override evidence directory |
| `--agent` | Who orchestrated the run (metadata in evidence) |
| `--model` | LLM model label (metadata) |
| `--acp` / `--executor=acp` | Dispatch instead of local execute |
| `--autoclean` | Delete prior evidence for same scenario code |

All other `--key value` pairs are **dynamic parameters** passed to the project adapter (`resolveParams`) and available as `{{key}}` in scenarios.

## Project config (consumer-owned)

```yaml
autoclean: true   # optional — delete prior evidence for same scenario code
adapter: <path-to-adapter-module>
specPath: <optional-project-spec-for-dispatch>
suites:
  <suite-id>:
    dir: <path-to-scenario-dir>
    codePrefix: <code-prefix->
```

Example: OpenADT uses `e2e.config.yaml` at repo root — see `specs/mcp-ai-testing.md`.

## Project adapter (consumer-owned)

Module must export `default`, `adapter`, or `createAdapter()` returning:

```typescript
interface E2eProjectAdapter {
  resolveParams?(raw, suiteId): Record<string, unknown> | Promise<...>
  createExecutor(scenario, ctx, suiteId): ToolExecutor
  serviceMode?(scenario, suiteId): string
}

interface ToolExecutor {
  start(): Promise<void>
  callTool(name, args): Promise<unknown>
  close(): void
}
```

- **resolveParams** — map CLI flags to `RunContext` (e.g. partial ids → full ids).
- **createExecutor** — spawn/connect to the real service for one scenario.
- **serviceMode** — optional evidence label.

## Scenario format

One markdown file per scenario: `<code>-<id>.md`

```yaml
---
code: test-1
id: smoke
title: Example smoke
given: Precondition with {{param}}
when: Action using {{param}}
then: Expected outcome
steps:
  - tool: some_tool
    args:
      key: "{{param}}"
    assert:
      contentContains: expected
      notError: true
---
```

### Assertion keys

| Key | Meaning |
| --- | ------- |
| `contentContains` | Response text includes substring(s) |
| `notError` | No tool-level error flag |
| `success` | Parsed envelope `success: true` when applicable |
| `minCount` | Minimum array length in structured JSON |
| `destinationsInclude` | Text includes value (consumer-defined semantics) |

## Evidence

Path: `<repo>/.e2e/results/<datetime>-<✅\|❌>-<code>-<hash>.md`

Stdout on local run ends with `E2E_EVIDENCE_FILE=<path>`.

## ACP dispatch

`dispatch` writes `.e2e/dispatch/<run-id>.json` with `command.local` — exact `e2e-agent run` invocation for an external agent. No ACP API is wired in the framework.

## Runtime dependencies (e2e-agent)

The Bun-published package is fully self-contained except for its declared
runtime + dev deps in `.agents/skills/e2e/package.json`:

| Dep | Role | Pin policy |
| --- | ---- | ---------- |
| `js-yaml` | YAML parser for project config + scenario frontmatter | Exact-pinned (CVE-2025-64718, CVE-2026-53550 advisory — bumping is a spec change) |
| `@types/js-yaml` | TypeScript types | Exact-pinned |
| `@types/node` | Node API types | Exact-pinned (avoid floating into a major that breaks `import.meta.dir`) |
| `typescript` | TypeScript compiler | Exact-pinned (the published `dist/` is built with the pinned version) |

The SkillSpector gate (see `specs/skillspector.md`) flags any move to
caret ranges (`^X.Y.Z`); bump a dep, open a spec amendment in
`specs/skillspector.md` §"Baseline findings" in the same PR.

## Agent contract

On `/e2e <code> [params]`:

1. Run `e2e-agent run <code> --config <project-config> [params]`
2. Read exit code and `E2E_EVIDENCE_FILE`
3. Report PASS/FAIL, Given/When/Then, assertion highlights

Do **not** import `scripts/framework/*`. Do **not** generate per-scenario runner scripts.
