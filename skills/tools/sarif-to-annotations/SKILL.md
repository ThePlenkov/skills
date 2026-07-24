---
name: sarif-to-annotations
description: >-
  Convert SARIF 2.1.0 reports to GitHub Actions workflow-command annotations.
  Use when a tool already emits SARIF (CodeQL, Snyk, ESLint, Semgrep, Trivy,
  etc.) and you want inline PR annotations instead of (or in addition to)
  the Security tab. Exit code reflects the presence of error-severity
  findings so the same script can serve as both annotator and workflow gate.
tier: 2
triggers: [user, model]
source: theplenkov-ai/skills
---

# SARIF → GitHub Actions Annotations

## Why

GitHub removed Code Scanning (SARIF uploads to the Security tab) for
free-tier repositories. Tools that natively produce SARIF — CodeQL,
Snyk, ESLint, Semgrep, Trivy, SkillSpector via the `actions/skillspector`
wrapper, etc. — still work, but their findings no longer surface in
the PR.

This skill converts a SARIF document on stdin to GitHub Actions
**workflow commands** ([docs][wf]), which are rendered as inline
annotations on PR lines. The conversion is lossless for the common
fields and **enriches** the annotation when the SARIF document carries
extra metadata in `properties` (the standard SARIF extension point).

[wf]: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands

## When to use this vs `actions/skillspector`

| You have | Use |
|----------|-----|
| Skillspector JSON, want PR annotations + optional SARIF | actions/skillspector — the action handles install, per-skill iteration, JSON→SARIF translation, and emits annotations in one step |
| Any other tool's SARIF (CodeQL, Snyk, ESLint, Semgrep, Trivy) | This skill's `scripts/to-annotations.py` — pipe `report.sarif` in, get annotations out |

The action is a self-contained Skillspector wrapper; this skill is
the generic SARIF→annotations converter that the action itself uses
internally for its SARIF output mode. You don't normally call this
skill from a workflow that uses the action — but you might call it
from a CodeQL or Snyk workflow.

## Usage from a workflow

```yaml
- name: Run a tool that emits SARIF
  run: codeql database analyze --format sarif-latest --output report.sarif

- name: Emit annotations
  run: |
    python3 scripts/to-annotations.py < report.sarif
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0    | No `error`-level results in the SARIF document (or `errors: 0`) |
| 1    | One or more `error`-level results (HIGH/CRITICAL findings) |
| 2    | Invalid input / parse error |

The non-zero exit on errors lets the same script serve double duty:
emit annotations AND gate the workflow.

## Mapping

| SARIF `level` | Annotation | UI color |
|---------------|------------|----------|
| `error`       | `::error`  | red      |
| `warning`     | `::warning`| yellow   |
| `note`        | `::notice` | blue     |
| `none` or missing | `::notice` | blue  |

The annotation `title` is built as:

```
[<tags>] <toolName>[<ruleId>]: <category or rule name>
```

Where `tags` and `category` come from `properties` when present.
For example, a Skillspector finding with
`properties.tags = ["ASI02"]` and
`properties.category = "MCP Least Privilege"` produces the title:

```
[ASI02]skillspector[LP3]: MCP Least Privilege
```

The annotation message body is built as a ` — `-separated list of
sections, in this order:

1. **Intent** — from `properties.intent` (when present)
2. **Explanation** — the SARIF `message.text`
3. **Fix** — from `properties.remediation` (when present)
4. **Code** — from `properties.code_snippet`, truncated to 400
   characters with `⏎` markers for embedded newlines
5. **Confidence** — from `properties.confidence` (numeric 0-1), as
   `confidence=N` (no `%` to avoid the GitHub `%25` double-escape
   trap)

The `file` / `line` / `endLine` are taken from
`locations[0].physicalLocation`.

## Supported SARIF subset

This skill handles SARIF 2.1.0 ([spec][spec]). It is **not** a full
SARIF implementation — it focuses on the common single-location,
single-message case. The following are intentionally **not** parsed:

- `fixes[]` (suggested edits)
- `codeFlows[]` (data-flow traces)
- `relatedLocations[]`
- `taxa` / `graphs`
- Multiple locations per result (only `locations[0]` is used)
- `suppressionStates[]` (suppressed results are still emitted)

[spec]: https://docs.oasis-open.org/sarif/sarif/v2.1.0/

## Robustness

The script is defensive against three real-world quirks:

1. **Progress text prepended to stdout.** Some tools (SkillSpector
   with `--recursive` is the canonical case) print progress lines to
   stdout **before** the actual JSON document. The script reads all
   of stdin and locates the first `{`, then parses from there.

2. **Empty results array.** A SARIF document with `"results": []`
   (clean run) is treated as success — exit 0, no annotations.

3. **Missing `runs[]`.** A SARIF document with no `runs` field (or
   `runs: null`) is treated as success — exit 0, no annotations.

4. **GitHub workflow-command escaping.** The message body is
   percent-escaped (`%` → `%25`) and newlines replaced with spaces
   before being emitted. Without this, percent introduces a
   data-section delimiter and newlines terminate the command line —
   both silently truncate the annotation. Tool-introduced percent
   signs are correctly preserved; our own format strings (e.g.
   `confidence=N`) avoid the percent character entirely to prevent
   double-escape.

## Files

```
skills/tools/sarif-to-annotations/
├── SKILL.md
├── scripts/
│   └── to-annotations.py            — SARIF → GitHub workflow commands
├── references/
│   └── SARIF.md       — notes on the SARIF subset we handle
└── assets/
    └── example.sarif  — small synthetic SARIF for testing
```