# `actions/skillspector`

Run [SkillSpector](https://github.com/NVIDIA/SkillSpector) on a single skill
or on every skill in a directory tree, and emit:

- **GitHub Actions workflow commands** for inline PR annotations
  (`::error|warning|notice file=…,line=…,title=…::message`)
- **Optional SARIF 2.1.0** report (e.g. for the Code Scanning tab or
  IDE plugins)
- **Structured step outputs** (`sarif-path`, `error-count`,
  `warning-count`, `total-count`)

The mapping is done **once**, in `scripts/emit.py`, so the SARIF
output and the GitHub annotations are guaranteed to be in sync. Both
can be active at the same time.

## Why not use the upstream `--format sarif`?

Upstream skillspector's `--format sarif` is a **lossy subset** of
`--format json` (see
[NVIDIA/SkillSpector#229](https://github.com/NVIDIA/SkillSpector/issues/229)).
The native SARIF output drops the high-signal per-issue fields:
`category`, `confidence`, `remediation`, `code_snippet`, `intent`,
`tags`, `end_line`. Without them, the GitHub annotation is reduced
to a bare-bones one-liner.

This action reads `--format json` (the rich output) and synthesizes
a SARIF document that **preserves all of those fields** under SARIF's
standard `properties` extension point. The same mapping is used to
build the GitHub annotation, which then surfaces the tag prefix, the
human-readable category, the remediation, the code snippet, and the
confidence.

## Usage

### Scan a single skill

```yaml
- uses: ThePlenkov/skills/actions/skillspector@main
  with:
    path: ./.agents/skills/act/
```

The action detects `path/SKILL.md` and treats the directory as a
single skill.

### Scan every skill in a directory

```yaml
- uses: ThePlenkov/skills/actions/skillspector@main
  with:
    path: ./.agents/skills/
```

The action iterates over every sub-directory of `path/` that contains
a `SKILL.md`, runs SkillSpector on each, and aggregates the findings.

### Write SARIF in addition to annotations

```yaml
- uses: ThePlenkov/skills/actions/skillspector@main
  with:
    path: ./.agents/skills/
    sarif: ${{ github.workspace }}/skillspector.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: ${{ steps.scan.outputs.sarif-path }}
```

`steps.scan.outputs.sarif-path` is set to the absolute path of the
written SARIF file. The SARIF document carries the full per-issue
schema in `properties` so any SARIF-aware downstream tool can read
the full context.

### Suppress annotations but still write SARIF

```yaml
- uses: ThePlenkov/skills/actions/skillspector@main
  with:
    path: ./.agents/skills/
    annotations: "false"
    sarif: ${{ github.workspace }}/skillspector.sarif
```

Useful when SARIF is the only consumer (e.g. the GitHub Code Scanning
tab on a paid plan).

### Don't fail the workflow on error-severity findings

```yaml
- uses: ThePlenkov/skills/actions/skillspector@main
  with:
    path: ./.agents/skills/
    fail-on-error: "false"
- uses: actions/labeler@v5
  if: steps.scan.outputs.error-count > 0
  with:
    add-labels: security-findings
```

The action still surfaces every finding (annotation, SARIF, step
outputs); it just doesn't fail. A separate job can decide what to
do with the counts.

## Inputs

| Name                  | Required | Default                       | Description                                                                                                    |
|-----------------------|----------|-------------------------------|----------------------------------------------------------------------------------------------------------------|
| `path`                | no       | `.`                           | Path to scan. Auto-detects single-skill (`path/SKILL.md` exists) vs multi-skill (iterates `path/*/SKILL.md`).  |
| `recursive`           | no       | `"false"`                     | Pass `--recursive` to skillspector. **Caveat:** `--recursive --format json` is summary-only upstream — see [NVIDIA/SkillSpector#228](https://github.com/NVIDIA/SkillSpector/issues/228). Default behavior already iterates per skill. |
| `baseline`            | no       | `""`                          | Path to `.skillspector-baseline.yaml` for known-issue suppression.                                              |
| `no-llm`              | no       | `"true"`                      | Pass `--no-llm` (recommended for CI; saves time and avoids network).                                          |
| `annotations`         | no       | `"true"`                      | Emit `::error`/`::warning`/`::notice` lines for inline PR annotations.                                         |
| `sarif`               | no       | `""`                          | Path to write a SARIF 2.1.0 report. Leave empty to skip.                                                       |
| `fail-on-error`       | no       | `"true"`                      | Exit 1 on error-severity findings. Set `"false"` to surface findings without failing.                         |
| `job-summary`         | no       | `"true"`                      | Append a markdown per-skill summary table to `$GITHUB_STEP_SUMMARY`.                                           |
| `skillspector-version`| no       | commit SHA pinned in action   | Pinned to a specific commit for reproducibility. Bump on purpose.                                              |

## Outputs

| Name            | Description                                                  |
|-----------------|--------------------------------------------------------------|
| `sarif-path`    | Absolute path to the SARIF file (empty if not written).      |
| `error-count`   | Total `error`-severity (HIGH/CRITICAL) findings across all skills. |
| `warning-count` | Total `warning`-severity findings.                           |
| `total-count`   | Total findings of any severity.                              |

## Annotation format

A typical error-severity finding produces:

```
::error file=SKILL.md,line=1,title=[ASI02]skillspector[LP3]: MCP Least Privilege::Without declared permissions the skill's intent is opaque and cannot be validated. — Fix: Add a 'permissions' field to SKILL.md listing the capabilities this skill requires. — confidence=90
```

Title: `[<tags>] <tool>[<rule>]: <category>` — tags come from
`properties.tags` (OWASP / MITRE / CWE / Agentic Security Index
categories).

Message: `Intent — Explanation — Fix — Code — Confidence`, joined
with ` — `. Code snippets are truncated to 400 chars with `⏎`
markers for embedded newlines.

## SARIF output

The SARIF document is a 1:1 translation of the upstream JSON
output:

- `tool.driver.rules[].{id, name, shortDescription, fullDescription, help, properties.tags}`
- `runs[].results[].{ruleId, level, message, locations, properties}`
- `properties` carries `category`, `confidence`, `remediation`,
  `code_snippet`, `intent`, `tags`, `pattern`, `finding` — all
  surfaced faithfully from the source JSON.

A downstream SARIF consumer that doesn't understand `properties`
will just ignore them; the standard fields (`ruleId`, `level`,
`message`, `locations`) are still valid SARIF.

## Files

```
actions/skillspector/
├── action.yml         — composite action definition
├── scripts/
│   └── emit.py        — the unified mapping (annotations + SARIF + step outputs)
├── tests/
│   ├── test_emit.py
│   └── fixtures/
│       ├── synthetic.json
│       └── act-scan.json
└── README.md
```

## Testing

```bash
python3 actions/skillspector/tests/test_emit.py
```

22 unit tests cover: annotation format, SARIF structure, properties
preservation, step output writing, stdin/file/prefix-tolerance, and
end-to-end with a real saved scan.