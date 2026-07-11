# SARIF subset handled by `to-annotations.py`

This document describes exactly which SARIF 2.1.0 fields
[to-annotations.py](../scripts/to-annotations.py) reads. Anything
not listed here is intentionally ignored.

## Top-level

| Field | Read? | Notes |
|-------|-------|-------|
| `version` | ✗ | Only `2.1.0` is supported in practice; not validated. |
| `runs`    | ✓ | Required. Iterated in array order. |
| `artifacts` | ✗ | Not read. `artifactLocation.uri` is treated as a path string verbatim. |
| `properties` | ✗ | Not read. |

## `runs[]`

| Field | Read? | Notes |
|-------|-------|-------|
| `tool.driver.name` | ✓ | Used in annotation `title` (e.g. `skillspector[LP3]`). |
| `tool.driver.rules[]` | ✓ | Mapped by `id`; `shortDescription.text` is read for the message prefix. |
| `tool.driver.informationUri` etc. | ✗ | Not surfaced. |
| `tool.extensions[]` | ✗ | Not read. |
| `results[]` | ✓ | The main payload. See below. |
| `invocations[]` | ✗ | Not read. |
| `originalUriBaseIds` | ✗ | Not used. SARIF paths in `artifactLocation.uri` are assumed to be repo-relative. |

## `runs[].results[]`

| Field | Read? | Notes |
|-------|-------|-------|
| `ruleId` | ✓ | Required. Used in `title` and as the key into the rules map. |
| `level` | ✓ | `error`/`warning`/`note`/`none` → `::error`/`::warning`/`::notice`/`::notice`. Missing → `warning`. |
| `message.text` | ✓ | The annotation body. |
| `locations[0]` | ✓ | Only the **first** location is used. |
| `locations[0].physicalLocation.artifactLocation.uri` | ✓ | Becomes `file=...`. Treated as a path string. |
| `locations[0].physicalLocation.region.startLine` | ✓ | Becomes `line=...`. |
| `locations[0].physicalLocation.region.startColumn` | ✓ | Becomes `col=...`. |
| `locations[0].physicalLocation.region.endLine` | ✓ | Becomes `endLine=...`. |
| `locations[0].physicalLocation.region.endColumn` | ✓ | Becomes `endColumn=...`. |
| `locations[1..N]` | ✗ | Silently dropped. Most tools emit one location per result. |
| `partialFingerprints` / `fingerprints` | ✗ | Not used (annotations don't deduplicate). |
| `ruleIndex` | ✗ | Not used. |
| `properties` / `tags` | ✗ | Not read. |
| `fixes[]` | ✗ | Suggested fixes are not emitted (no GitHub command for that). |
| `codeFlows[]` | ✗ | Data-flow traces are not emitted. |
| `relatedLocations[]` | ✗ | Not emitted as separate annotations. |
| `suppressionStates[]` | ✗ | Suppressed results are still emitted. |

## Behavior when fields are missing

| Missing | Behavior |
|---------|----------|
| `runs[].results[]` | Empty → exit 0. |
| `ruleId` on a result | Falls back to `?` in the title. |
| `level` on a result | Defaults to `warning`. |
| `message.text` on a result | Annotation body is `(no message)`. |
| All `locations[]` on a result | Annotation is emitted **without** `file=...`. The annotation shows up at the top of the PR Files Changed tab rather than on a specific line. |
| `tool.driver.name` | Defaults to `tool`. |
| `tool.driver.rules[]` | Rules map is empty; no `shortDescription` prefix is added. |

## Robustness

The script is defensive against three real-world quirks:

1. **Progress text prepended to stdout.** Some tools (SkillSpector
   with `--recursive` is the canonical case) print progress lines to
   stdout **before** the actual JSON document:

   ```
   Multi-skill directory detected: 43 skills found

     [1/43] Scanning act (act/)
            Score: 25/100 (MEDIUM)
     ...
   {
     "$schema": "...",
     "version": "2.1.0",
     "runs": [...]
   }
   ```

   The converter reads the entire stdin and locates the first `{`,
   then parses from there. Any leading progress text is silently
   dropped. (If you see a `##[error]no JSON object found in input`
   message, your tool did not produce SARIF at all and the file
   probably needs investigation.)

2. **Empty results array.** A SARIF document with `"results": []`
   (clean run) is treated as success — exit 0, no annotations.

3. **Missing `runs[]`.** A SARIF document with no `runs` field (or
   `runs: null`) is treated as success — exit 0, no annotations.
   This is a defensive default; per the SARIF spec, a run with no
   results is valid and not an error.

## Path handling

`artifactLocation.uri` is passed through **verbatim** to the annotation
`file=` parameter. The script does not resolve `uriBaseId` references,
does not normalize paths, and does not strip prefixes. If a tool
emits `file:///path/to/file` it stays `file=file:///path/to/file`,
which GitHub will not resolve to a PR line.

In practice, every tool we use (SkillSpector, CodeQL, etc.) emits
repo-relative paths without a scheme. If you find a tool that
emits absolute paths, write a small preprocessor to strip them
before piping into `to-annotations.py`.

## Exit code semantics

- `0` — no `level == "error"` results
- `1` — one or more `level == "error"` results
- `2` — input was not valid JSON

This means the same script can both **emit annotations** (always,
regardless of exit code) and **gate the workflow** (fail when
errors are present). Set the CI step's `if: always()` if you want
the annotations to appear even on failure; otherwise GitHub
short-circuits and won't run the step on a previously-failed job.