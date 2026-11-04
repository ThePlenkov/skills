# `actions/skillspector`

Run [SkillSpector](https://github.com/NVIDIA/SkillSpector) on a single skill
or on every skill in a directory tree, and emit:

- **GitHub Actions workflow commands** for inline PR annotations
  (`::error|warning|notice file=…,line=…,title=…::message`)
- **Optional SARIF 2.1.0** report (e.g. for the Code Scanning tab or
  IDE plugins)
- **Structured step outputs** (`sarif-path`, `error-count`,
  `warning-count`, `total-count`)

The action is implemented as a self-contained **Nx workspace with a
plugin**. The plugin (`@theplenkov/nx-skillspector`) infers a `scan`
target for every directory containing `SKILL.md` — no `project.json`
files in the host repo, no host-side Nx setup required.

## Why an Nx plugin?

Plugin with `createNodesV2` (inferred tasks) gives us:

1. **Zero host-repo coupling** — the host doesn't need an Nx
   workspace, project.json files, or any nx config. The action
   brings its own Nx + plugin.
2. **Per-skill caching** — Nx hashes the skill's source files
   (SKILL.md + scripts/ + references/ + assets/) and reuses cached
   results when nothing changed. Re-runs of the same CI step take
   milliseconds instead of re-scanning everything.
3. **Built-in parallelism** — `nx run-many --parallel=N` runs N
   skills concurrently without writing our own ProcessPoolExecutor.
4. **TypeScript end-to-end** — Node 22+ runs TypeScript natively
   (`--experimental-strip-types`), so the plugin has no build step.
5. **Reusable beyond this action** — the plugin lives in
   `actions/skillspector/nx-skillspector/` as a local package and
   can be promoted to npm later for use in other repos.

## Why not use the upstream `--format sarif`?

Upstream skillspector's `--format sarif` is a **lossy subset** of
`--format json` (see
[NVIDIA/SkillSpector#229](https://github.com/NVIDIA/SkillSpector/issues/229)).
The native SARIF output drops the high-signal per-issue fields:
`category`, `confidence`, `remediation`, `code_snippet`, `intent`,
`tags`, `end_line`. Without them, the GitHub annotation is reduced
to a bare-bones one-liner.

The plugin's executor reads `--format json` (the rich output) and
synthesizes a SARIF document that **preserves all of those fields**
under SARIF's standard `properties` extension point. The same mapping
is used to build the GitHub annotation, which surfaces the tag
prefix, the human-readable category, the remediation, the code
snippet, and the confidence.

## Usage

```yaml
- uses: ThePlenkov/skills/actions/skillspector@ci/workflow-annotations
  with:
    path: ./.agents/skills/
```

The plugin auto-detects single-skill vs parent-of-many:

- `path: ./.agents/skills/act/` — single skill
- `path: ./.agents/skills/` — every sub-directory with `SKILL.md`

### Write SARIF + annotations

```yaml
- uses: ThePlenkov/skills/actions/skillspector@ci/workflow-annotations
  with:
    path: ./.agents/skills/
    sarif: ${{ github.workspace }}/skillspector.sarif
```

### Don't fail on errors (separate gate)

```yaml
- uses: ThePlenkov/skills/actions/skillspector@ci/workflow-annotations
  with:
    path: ./.agents/skills/
    fail-on-error: 'false'
```

## Inputs

| Name                   | Required | Default                       | Description                                                                                                    |
|------------------------|----------|-------------------------------|----------------------------------------------------------------------------------------------------------------|
| `path`                 | no       | `.`                           | Reserved for future use. Currently the Nx plugin discovers all `SKILL.md` files via the `**/SKILL.md` glob in `nx.json`, so this input is not wired to the scan. Kept for backwards compatibility. |
| `recursive`            | no       | `"false"`                     | Pass `--recursive` to skillspector. Caveat documented in NVIDIA/SkillSpector#228.                              |
| `baseline`             | no       | `""`                          | Path to `.skillspector-baseline.yaml`.                                                                         |
| `no-llm`               | no       | `"true"`                      | Pass `--no-llm` (recommended for CI).                                                                          |
| `annotations`          | no       | `"true"`                      | Emit `::error`/`::warning`/`::notice` lines for inline PR annotations.                                         |
| `sarif`                | no       | `""`                          | Path to write a SARIF 2.1.0 report.                                                                            |
| `fail-on-error`        | no       | `"true"`                      | Exit 1 on error-severity findings.                                                                             |
| `skillspector-version` | no       | commit SHA pinned in action   | Pinned for reproducibility. Bump on purpose.                                                                   |
| `parallelism`          | no       | `""` (uses `nproc`)          | Max concurrent skill scans. Set to `"1"` for sequential.                                                       |
| `affected`            | no       | `"true"`                     | When `"true"`, use `nx affected` to scan only skills whose files changed since the base SHA. Requires `nx-set-shas` upstream. When `"false"`, always scan every skill. |

## Outputs

| Name            | Description                                                  |
|-----------------|--------------------------------------------------------------|
| `sarif-path`    | Absolute path to the SARIF file (empty if not written).      |
| `error-count`   | Total `error`-severity (HIGH/CRITICAL) findings.             |
| `warning-count` | Total `warning`-severity findings.                           |
| `total-count`   | Total findings of any severity.                              |

## Annotation format

```
::error file=SKILL.md,line=1,title=[ASI02]skillspector[LP3]: MCP Least Privilege::Without declared permissions the skill's intent is opaque and cannot be validated. — Fix: Add a 'permissions' field to SKILL.md listing the capabilities this skill requires. — confidence=90
```

Title: `[<tags>] <tool>[<rule>]: <category>` — tags come from
`properties.tags` (OWASP / MITRE / CWE / Agentic Security Index).

Message: `Intent — Explanation — Fix — Code — Confidence`, joined
with ` — `. Code snippets truncated to 400 chars; newlines replaced
with `⏎` markers.

## Files

```
actions/skillspector/
├── action.yml                 composite action definition
├── nx.json                    workspace + plugin registration + cache inputs
├── package.json               nx 23 + typescript 6 + @nx/devkit + plugin
└── nx-skillspector/           local plugin package
    ├── package.json           exports source via @nx/nx-source
    └── src/
        ├── plugin.ts          createNodesV2: walks workspace for SKILL.md, infers scan target
        ├── executors.json     executor config
        ├── executors/scan/
        │   ├── executor.ts    child_process.spawn wrapper, SARIF merge, annotation emit
        │   └── schema.json    executor input schema
        └── lib/
            ├── skillspector.ts  CLI wrapper
            ├── mapping.ts       JSON → SARIF (preserves properties)
            ├── annotations.ts   JSON → workflow commands
            └── sarif.ts         SARIF types + schema URL
```