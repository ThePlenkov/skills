---
name: sarif-to-annotations
description: >-
  Convert SARIF 2.1.0 reports to GitHub Actions workflow-command annotations.
  Use when a CI tool emits SARIF (SkillSpector, CodeQL, Snyk, ESLint, etc.)
  and you want inline PR annotations instead of (or in addition to) the
  Security tab. Pipe SARIF JSON in, get ::error/::warning/::notice commands
  out, one per result. Exit code reflects the presence of error-severity
  findings so it can also serve as a workflow gate.
---

# SARIF → GitHub Actions Annotations

## Why

GitHub removed Code Scanning (SARIF uploads to the Security tab) for
free-tier repositories. Tools that natively produce SARIF — SkillSpector,
CodeQL, Snyk, ESLint, Semgrep, Trivy, etc. — still work, but their
findings no longer surface in the PR.

This skill converts a SARIF document on stdin to GitHub Actions
**workflow commands** ([docs][wf]), which are rendered as inline
annotations on PR lines. The conversion is lossless for the common
fields: `ruleId`, `level`, `message`, `locations[0].physicalLocation`.

[wf]: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands

## Usage

```bash
# Most tools write SARIF to a file
tool-that-emits-sarif --output report.sarif

# Convert to annotations
python3 .agents/skills/sarif-to-annotations/scripts/to-annotations.py < report.sarif

# Or pipe directly
tool-that-emits-sarif --output - | python3 .agents/skills/sarif-to-annotations/scripts/to-annotations.py
```

### From a workflow

```yaml
- name: Run scan
  run: tool-that-emits-sarif --output report.sarif

- name: Emit annotations
  run: |
    python3 .agents/skills/sarif-to-annotations/scripts/to-annotations.py < report.sarif
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0    | No `error`-level results in the SARIF document |
| 1    | One or more `error`-level results (HIGH/CRITICAL findings) |
| 2    | Invalid JSON / parse error |

The non-zero exit on errors lets the same script serve double duty:
emit annotations AND gate the workflow.

## Mapping

| SARIF `level` | Annotation | UI color |
|---------------|------------|----------|
| `error`       | `::error`  | red      |
| `warning`     | `::warning`| yellow   |
| `note`        | `::notice` | blue     |
| `none` or missing | `::notice` | blue  |

The annotation `title` is `<toolName>[<ruleId>]`, e.g.
`skillspector[LP3]`. The `file` / `line` / `col` are taken from
`locations[0].physicalLocation`.

If a rule has a `shortDescription` in `tool.driver.rules[]`, it is
prepended to the message: `<short> — <message>`.

## Supported SARIF subset

This skill handles SARIF 2.1.0 ([spec][spec]). It is **not** a full
SARIF implementation — it focuses on the common single-location,
single-message case. The following are intentionally **not** parsed:

- `fixes[]` (suggested edits)
- `codeFlows[]` (data-flow traces)
- `relatedLocations[]`
- `properties` / `taxa` / `graphs`
- Multiple locations per result (only `locations[0]` is used)

If a result has no `locations`, the annotation is emitted **without**
a `file=` parameter — it shows up at the top of the PR Files Changed
tab rather than on a specific line. This is intentional: silent
discarding of un-locatable results would be worse.

[spec]: https://docs.oasis-open.org/sarif/sarif/v2.1.0/

## Files

```
.agents/skills/sarif-to-annotations/
├── SKILL.md           — this file
├── scripts/
│   └── to-annotations.py    — the converter
├── references/
│   └── SARIF.md       — notes on the SARIF subset we handle
└── assets/
    └── example.sarif  — small synthetic SARIF for testing
```