---
name: sarif-to-annotations
description: >-
  Convert SARIF 2.1.0 reports to GitHub Actions workflow-command annotations,
  and (when needed) translate tools' JSON output to enriched SARIF first.
  Use when a CI tool produces SARIF or a richer JSON (SkillSpector, CodeQL,
  Snyk, ESLint, Semgrep, Trivy, etc.) and you want inline PR annotations
  instead of (or in addition to) the Security tab. Exit code reflects the
  presence of error-severity findings so the same scripts can serve as
  both annotator and workflow gate.
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
fields and **enriches** the annotation when the SARIF document carries
extra metadata in `properties` (which is the case for SARIF documents
produced by our JSON→SARIF wrapper for tools that natively emit JSON).

[wf]: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands

## Two entry points

This skill exposes two scripts:

1. **`scripts/to-annotations.py`** — SARIF → GitHub workflow commands.
   Reads SARIF from stdin, emits `::error|warning|notice` lines to
   stdout. This is the script you want if your tool already emits
   SARIF (CodeQL, ESLint via `sarif` reporter, Snyk, Trivy, etc.).

2. **`scripts/skillspector-json-to-sarif.py`** — JSON → enriched SARIF.
   Reads **skillspector**'s native JSON output from stdin, writes a
   SARIF 2.1.0 document to stdout that preserves the JSON's full
   per-issue schema (category, confidence, remediation, code_snippet,
   intent, tags, end_line) under SARIF's standard `properties`
   extension point. Use this **before** `to-annotations.py` if your
   tool is skillspector (or any tool whose native SARIF output is a
   lossy subset of its native JSON output).

Typical pipeline for skillspector:

```bash
skillspector scan ./skill --format json \
  | python3 .agents/skills/sarif-to-annotations/scripts/skillspector-json-to-sarif.py \
  | python3 .agents/skills/sarif-to-annotations/scripts/to-annotations.py
```

Typical pipeline for a tool that already emits SARIF (CodeQL, etc.):

```bash
tool-that-emits-sarif --output report.sarif
python3 .agents/skills/sarif-to-annotations/scripts/to-annotations.py < report.sarif
```

## Usage from a workflow

```yaml
- name: Run scan
  run: skillspector scan . --format json > report.json

- name: Emit annotations
  run: |
    python3 .agents/skills/sarif-to-annotations/scripts/skillspector-json-to-sarif.py < report.json \
      | python3 .agents/skills/sarif-to-annotations/scripts/to-annotations.py
```

### Exit codes (both scripts)

| Code | Meaning |
|------|---------|
| 0    | No `error`-level results in the SARIF document (or `errors: 0`) |
| 1    | One or more `error`-level results (HIGH/CRITICAL findings) |
| 2    | Invalid input / parse error |

The non-zero exit on errors lets the same scripts serve double duty:
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

Where `tags` and `category` come from `properties` when present. For
example, a skillspector finding with `properties.tags = ["ASI02"]` and
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

The `file` / `line` / `col` / `endLine` / `endColumn` are taken from
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

Both scripts are defensive against three real-world quirks:

1. **Progress text prepended to stdout.** Some tools (SkillSpector
   with `--recursive` is the canonical case) print progress lines to
   stdout **before** the actual JSON document. The scripts read all of
   stdin and locate the first `{`, then parse from there.

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
.agents/skills/sarif-to-annotations/
├── SKILL.md
├── scripts/
│   ├── to-annotations.py            — SARIF → GitHub workflow commands
│   └── skillspector-json-to-sarif.py — JSON → enriched SARIF
├── references/
│   └── SARIF.md       — notes on the SARIF subset we handle
└── assets/
    └── example.sarif  — small synthetic SARIF for testing
```