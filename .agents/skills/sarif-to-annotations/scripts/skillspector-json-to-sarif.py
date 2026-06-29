#!/usr/bin/env python3
"""
skillspector-json-to-sarif.py — convert a skillspector 2.3.7 JSON report
into a SARIF 2.1.0 document, preserving fields that skillspector's own
--format sarif drops.

Skillspector's native --format sarif only carries ruleId, level,
message, locations. The --format json output has a much richer
schema (per-issue category, confidence, remediation, code_snippet,
intent, tags, end_line, pattern, finding). We use --format json as
the source of truth and synthesize a SARIF document with the extra
fields tucked into SARIF's `properties` object — the standard
extension point that downstream tools are expected to read but
ignore if they don't understand them.

Why this is structured as JSON→SARIF rather than JSON→annotations:
  the downstream `to-annotations.py` script already knows how to
  surface SARIF `properties` as annotation metadata. Keeping the
  conversion in two stages means the enrichment layer is reusable
  for any future tool that emits JSON.

Reads a skillspector JSON document from stdin, writes SARIF to stdout.
"""
import json
import sys


# Per the SARIF 2.1.0 spec, `level` ∈ {none, note, warning, error}.
# Skillspector severities map cleanly to that.
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


def issue_to_result(issue, rule_index):
    """Convert one skillspector issue to one SARIF result."""
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

    # Preserve everything else in `properties` so downstream tools
    # (and our own to-annotations.py) can surface it.
    properties = {}
    for key in (
        "category", "confidence", "remediation", "code_snippet",
        "intent", "tags", "pattern", "finding",
    ):
        val = issue.get(key)
        if val is not None and val != "" and val != []:
            properties[key] = val

    result = {
        "ruleId":   issue.get("id", "?"),
        "level":    level,
        "message":  {"text": issue.get("explanation", "(no explanation)")},
        "ruleIndex": rule_index.get(issue.get("id", "?"), 0),
    }
    if locations:
        result["locations"] = locations
    if properties:
        result["properties"] = properties
    return result


def issues_to_rules(issues):
    """Build tool.driver.rules[] from the set of distinct ruleIds."""
    seen = {}
    rule_list = []
    for issue in issues:
        rid = issue.get("id")
        if not rid or rid in seen:
            continue
        seen[rid] = True
        rule_index = len(rule_list)
        rule = {
            "id":   rid,
            "name": rid,
            "shortDescription": {"text": issue.get("category", rid)},
            "fullDescription":  {"text": issue.get("explanation", "")},
        }
        # Many CWE/OWASP/MITRE categories live in `tags`. Surface them
        # as `properties.tags` on the rule too so the standard SARIF
        # rule-query API can find them.
        if issue.get("tags"):
            rule["properties"] = {"tags": issue["tags"]}
        if issue.get("remediation"):
            rule["help"] = {
                "text":     issue["remediation"],
                "markdown": "**Fix:** " + issue["remediation"],
            }
        rule_list.append(rule)
    return rule_list, {r["id"]: i for i, r in enumerate(rule_list)}


def build_run(skillspector_doc):
    """Translate a single skillspector JSON document into one SARIF run."""
    issues = skillspector_doc.get("issues") or []
    rules, rule_index = issues_to_rules(issues)
    results = [issue_to_result(i, rule_index) for i in issues]

    skill_meta = skillspector_doc.get("skill") or {}
    return {
        "tool": {
            "driver": {
                "name":           "skillspector",
                "version":        (skillspector_doc.get("metadata") or {}).get("skillspector_version", ""),
                "informationUri": "https://github.com/NVIDIA/skillspector",
                "rules":          rules,
            },
        },
        "originalUriBaseIds": {
            "PROJECTROOT": {"uri": "file://" + (skill_meta.get("source") or "")}
        },
        "results": results,
    }


def main():
    try:
        raw = sys.stdin.read()
    except Exception as e:
        sys.stderr.write("::error title=skillspector-json-to-sarif::read failed: " + str(e) + "\n")
        sys.exit(2)

    # Skillspector --recursive emits progress text before the JSON.
    # Locate the first '{' to be robust against that pattern.
    start = raw.find("{")
    if start < 0:
        sys.stderr.write("::error title=skillspector-json-to-sarif::no JSON object found in input\n")
        sys.exit(2)
    try:
        doc = json.loads(raw[start:])
    except json.JSONDecodeError as e:
        sys.stderr.write("::error title=skillspector-json-to-sarif::invalid JSON: " + str(e) + "\n")
        sys.exit(2)

    sarif = {
        "$schema": "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json",
        "version": "2.1.0",
        "runs":    [build_run(doc)],
    }
    json.dump(sarif, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()