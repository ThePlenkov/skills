#!/usr/bin/env python3
"""
emit.py — skillspector JSON → GitHub annotations + optional SARIF.

Single entry point used by the `actions/skillspector` composite action.
Reads a skillspector 2.3.7 JSON document, performs the per-issue mapping
**once**, and writes the result to one or both of:

  1. **GitHub workflow commands** (inline PR annotations) — stdout
  2. **SARIF 2.1.0** (file, opt-in via `--sarif-out`) — file

The mapping preserves skillspector's full per-issue schema (category,
confidence, remediation, code_snippet, intent, tags, end_line) under
SARIF's standard `properties` extension point, so any SARIF-aware
downstream tool (Code Scanning tab, IDE plugins, dashboards) can read
the full context.

### Why this script is the only mapping logic

  - It does what the upstream `--format sarif` should do (faithful
    translation of the JSON schema) but doesn't, because of
    NVIDIA/SkillSpector issues #228 and #229.
  - The matching `to-annotations.py` in
    `.agents/skills/sarif-to-annotations/scripts/` exists for tools
    that emit SARIF natively (CodeQL, Snyk, ESLint, Semgrep, Trivy)
    and is a thin, generic, read-only converter. This script is the
    skillspector-specific rich end of the pipeline.

### Exit codes

  0  no error-severity findings (or --no-fail-on-error)
  1  one or more error-severity findings
  2  invalid input / parse error
"""
import argparse
import json
import os
import sys


# -----------------------------------------------------------------------
# Mapping tables
# -----------------------------------------------------------------------

# Skillspector severities → SARIF levels. SARIF spec: level ∈
# {none, note, warning, error}.
SEVERITY_TO_LEVEL = {
    "HIGH":     "error",
    "CRITICAL": "error",
    "MEDIUM":   "warning",
    "WARNING":  "warning",
    "LOW":      "note",
    "INFO":     "note",
    "NOTE":     "note",
    "NONE":     "none",
}

# SARIF level → GitHub workflow command name.
LEVEL_TO_GH_CMD = {
    "error":   "error",
    "warning": "warning",
    "note":    "notice",
    "none":    "notice",
}


# -----------------------------------------------------------------------
# SARIF construction
# -----------------------------------------------------------------------

def issue_to_sarif_result(issue, rule_index):
    """Translate one skillspector issue to one SARIF result object."""
    sev = (issue.get("severity") or "").upper()
    level = SEVERITY_TO_LEVEL.get(sev, "warning")

    location = issue.get("location") or {}
    artifact_uri = location.get("file", "")
    start_line = location.get("start_line")
    end_line = location.get("end_line")

    physical_location = {}
    if artifact_uri:
        physical_location["artifactLocation"] = {"uri": artifact_uri}
    region = {}
    if start_line is not None:
        region["startLine"] = start_line
    if end_line is not None:
        region["endLine"] = end_line
    if region:
        physical_location["region"] = region

    locations = []
    if physical_location:
        locations.append({"physicalLocation": physical_location})

    # Pack everything else under `properties` (SARIF's standard
    # extension point — see SARIF 2.1.0 §3.27.14).
    properties = {}
    for key in (
        "category", "confidence", "remediation", "code_snippet",
        "intent", "tags", "pattern", "finding",
    ):
        val = issue.get(key)
        if val is not None and val != "" and val != []:
            properties[key] = val

    rule_id = issue.get("id", "?")

    result = {
        "ruleId":    rule_id,
        "level":     level,
        "message":   {"text": issue.get("explanation", "(no explanation)")},
        "ruleIndex": rule_index.get(rule_id, 0),
    }
    if locations:
        result["locations"] = locations
    if properties:
        result["properties"] = properties
    return result


def issues_to_sarif_rules(issues):
    """Build tool.driver.rules[] from the distinct set of ruleIds."""
    seen = set()
    rule_list = []
    for issue in issues:
        rid = issue.get("id")
        if not rid or rid in seen:
            continue
        seen.add(rid)
        rule = {
            "id":   rid,
            "name": rid,
            "shortDescription": {"text": issue.get("category", rid)},
            "fullDescription":  {"text": issue.get("explanation", "")},
        }
        if issue.get("tags"):
            rule["properties"] = {"tags": issue["tags"]}
        if issue.get("remediation"):
            rule["help"] = {
                "text":     issue["remediation"],
                "markdown": "**Fix:** " + issue["remediation"],
            }
        rule_list.append(rule)
    return rule_list, {r["id"]: i for i, r in enumerate(rule_list)}


def build_sarif(doc, tool_name="skillspector"):
    """Translate one skillspector document to one SARIF run."""
    issues = doc.get("issues") or []
    rules, rule_index = issues_to_sarif_rules(issues)
    results = [issue_to_sarif_result(i, rule_index) for i in issues]

    skill_meta = doc.get("skill") or {}
    metadata = doc.get("metadata") or {}
    return {
        "tool": {
            "driver": {
                "name":           tool_name,
                "version":        metadata.get("skillspector_version", ""),
                "informationUri": "https://github.com/NVIDIA/skillspector",
                "rules":          rules,
            },
        },
        "originalUriBaseIds": {
            "PROJECTROOT": {"uri": "file://" + (skill_meta.get("source") or "")}
        },
        "results": results,
    }


# -----------------------------------------------------------------------
# GitHub annotation construction
# -----------------------------------------------------------------------

def build_title(tool_name, rule_id, properties):
    """Build a richer annotation title.

    Form: <tags?> <toolName>[<ruleId>]: <category or rule name>
    """
    parts = []
    tags = (properties or {}).get("tags") or []
    if tags:
        seen = set()
        tag_strs = []
        for t in tags:
            if t and t not in seen:
                seen.add(t)
                tag_strs.append(str(t))
        if tag_strs:
            parts.append("[" + " ".join(tag_strs) + "]")
    parts.append(tool_name + "[" + rule_id + "]")
    category = (properties or {}).get("category")
    if category:
        parts.append(": " + category)
    return "".join(parts)


def build_message(explanation, properties):
    """Compose the annotation message body.

    Order: Intent → Explanation → Fix → Code → Confidence, joined
    with ' — '. Code is truncated to 400 chars. Confidence avoids
    a literal '%' (would be double-escaped by the GitHub
    workflow-command `%` → `%25` rule).
    """
    out = []
    intent = (properties or {}).get("intent")
    if intent:
        out.append("Intent: " + intent)
    if explanation:
        out.append(explanation)
    fix = (properties or {}).get("remediation")
    if fix:
        out.append("Fix: " + fix)
    snippet = (properties or {}).get("code_snippet")
    if snippet:
        max_len = 400
        flat = snippet.replace("\n", " ⏎ ")
        if len(flat) > max_len:
            flat = flat[: max_len - 1] + "…"
        out.append("Code: " + flat)
    confidence = (properties or {}).get("confidence")
    if confidence is not None:
        try:
            pct = int(round(float(confidence) * 100))
            out.append("confidence=" + str(pct))
        except (TypeError, ValueError):
            pass
    return " — ".join(out)


def issue_to_annotation(issue, tool_name):
    """Render one skillspector issue as one GitHub workflow command line."""
    sev = (issue.get("severity") or "").upper()
    level = SEVERITY_TO_LEVEL.get(sev, "warning")
    gh_cmd = LEVEL_TO_GH_CMD.get(level, "notice")

    properties = {}
    for key in (
        "category", "confidence", "remediation", "code_snippet",
        "intent", "tags", "pattern", "finding",
    ):
        val = issue.get(key)
        if val is not None and val != "" and val != []:
            properties[key] = val

    rule_id = issue.get("id", "?")
    title = build_title(tool_name, rule_id, properties)
    message = build_message(issue.get("explanation", "(no explanation)"), properties)

    location = issue.get("location") or {}
    file_uri = location.get("file", "")
    start_line = location.get("start_line")
    end_line = location.get("end_line")

    parts = []
    if file_uri:
        parts.append("file=" + file_uri)
    if start_line is not None:
        parts.append("line=" + str(start_line))
    if end_line is not None:
        parts.append("endLine=" + str(end_line))
    parts.append("title=" + title)
    props = ",".join(parts)

    safe_msg = (
        message
        .replace("%", "%25")
        .replace("\r", " ")
        .replace("\n", " ")
    )
    return "::" + gh_cmd + " " + props + "::" + safe_msg


# -----------------------------------------------------------------------
# GitHub Actions step output
# -----------------------------------------------------------------------

def write_step_outputs(error_count, warning_count, total_count, sarif_path):
    """Append key=value pairs to $GITHUB_OUTPUT (no-op outside Actions)."""
    gh_output = os.environ.get("GITHUB_OUTPUT")
    if not gh_output:
        return
    with open(gh_output, "a", encoding="utf-8") as f:
        f.write("error-count=" + str(error_count) + "\n")
        f.write("warning-count=" + str(warning_count) + "\n")
        f.write("total-count=" + str(total_count) + "\n")
        if sarif_path:
            f.write("sarif-path=" + sarif_path + "\n")


# -----------------------------------------------------------------------
# Job summary (optional)
# -----------------------------------------------------------------------

def write_job_summary(per_skill, error_count, warning_count, total_count):
    """Write a markdown summary to $GITHUB_STEP_SUMMARY (no-op outside)."""
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary:
        return
    lines = []
    lines.append("## SkillSpector scan")
    lines.append("")
    lines.append("- Total findings: **" + str(total_count) + "**")
    lines.append("- Error-severity: **" + str(error_count) + "**")
    lines.append("- Warning-severity: " + str(warning_count))
    lines.append("")
    if per_skill:
        lines.append("| Skill | Errors | Warnings | Total |")
        lines.append("| --- | ---:| ---:| ---:|")
        for skill, counts in per_skill.items():
            lines.append(
                "| " + skill
                + " | " + str(counts["errors"])
                + " | " + str(counts["warnings"])
                + " | " + str(counts["total"])
                + " |"
            )
        lines.append("")
    with open(summary, "a", encoding="utf-8") as f:
        f.write("\n".join(lines))


# -----------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------

def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Map skillspector JSON to GitHub annotations + optional SARIF.",
    )
    p.add_argument(
        "--input", "-i", default=None,
        help="Path to a skillspector JSON file (default: stdin).",
    )
    p.add_argument(
        "--tool-name", default="skillspector",
        help="Tool name to surface in annotation titles (default: skillspector).",
    )
    p.add_argument(
        "--no-annotations", action="store_true",
        help="Suppress GitHub workflow commands (annotations).",
    )
    p.add_argument(
        "--sarif-out", metavar="PATH", default=None,
        help="Write SARIF 2.1.0 to PATH (in addition to, or instead of, annotations).",
    )
    p.add_argument(
        "--fail-on-error", dest="fail_on_error", action="store_true", default=True,
        help="Exit 1 when any error-severity result is found (default: on).",
    )
    p.add_argument(
        "--no-fail-on-error", dest="fail_on_error", action="store_false",
        help="Always exit 0, even on error-severity results.",
    )
    p.add_argument(
        "--no-step-output", action="store_true",
        help=(
            "Skip writing to $GITHUB_OUTPUT. Used by the parallel "
            "orchestrator, which is the sole writer of the final "
            "aggregated step outputs. When this flag is set, multiple "
            "emit.py instances can run concurrently without racing on "
            "$GITHUB_OUTPUT."
        ),
    )
    p.add_argument(
        "--write-summary", action="store_true",
        help="Append a markdown summary to $GITHUB_STEP_SUMMARY (default: off).",
    )
    p.add_argument(
        "--skill-name", default=None,
        help="Skill name for the job-summary table (only used with --write-summary).",
    )
    return p.parse_args(argv)


def load_input(path):
    if path:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return sys.stdin.read()


def parse_skillspector_json(raw):
    """Locate the first '{' (skillspector sometimes emits progress text
    first) and parse the rest as JSON. Returns (doc, error_message)."""
    start = raw.find("{")
    if start < 0:
        return None, "no JSON object found in input"
    try:
        return json.loads(raw[start:]), None
    except json.JSONDecodeError as e:
        return None, "invalid JSON: " + str(e)


def main(argv=None):
    args = parse_args(argv)
    raw = load_input(args.input)
    doc, err = parse_skillspector_json(raw)
    if err is not None:
        sys.stderr.write(
            "::error title=skillspector-emit::" + err + "\n"
        )
        sys.exit(2)

    issues = doc.get("issues") or []

    # ----- emit SARIF (optional) -----
    if args.sarif_out:
        sarif = {
            "$schema": "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json",
            "version": "2.1.0",
            "runs":    [build_sarif(doc, tool_name=args.tool_name)],
        }
        with open(args.sarif_out, "w", encoding="utf-8") as f:
            json.dump(sarif, f, indent=2)
            f.write("\n")

    # ----- emit GitHub annotations (default) -----
    error_count = 0
    warning_count = 0
    for issue in issues:
        sev = (issue.get("severity") or "").upper()
        level = SEVERITY_TO_LEVEL.get(sev, "warning")
        if level == "error":
            error_count += 1
        elif level == "warning":
            warning_count += 1
        if not args.no_annotations:
            print(issue_to_annotation(issue, args.tool_name))

    total_count = len(issues)

    # ----- step outputs (always; no-op outside Actions) -----
    if not args.no_step_output:
        write_step_outputs(error_count, warning_count, total_count, args.sarif_out)

    # ----- job summary (opt-in) -----
    if args.write_summary:
        per_skill = {}
        if args.skill_name:
            per_skill[args.skill_name] = {
                "errors":   error_count,
                "warnings": warning_count,
                "total":    total_count,
            }
        write_job_summary(per_skill, error_count, warning_count, total_count)

    if args.fail_on_error and error_count > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()