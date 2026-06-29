#!/usr/bin/env python3
"""
to-annotations.py — convert SARIF 2.1.0 to GitHub Actions workflow commands.

Reads a SARIF document from stdin, emits one
  ::error|warning|notice file=…,line=…,col=…,title=…::message
line per result to stdout.

Exit codes:
  0  no error-severity results
  1  one or more error-severity results (HIGH/CRITICAL findings)
  2  invalid input / parse error

This implements the common-case SARIF subset documented in SKILL.md.
Multiple locations per result are not supported — only locations[0]
is used. Results without locations produce annotations without a
file= parameter (still visible, just not on a specific line).
"""
import json
import sys

LEVEL_MAP = {
    "error":   "error",
    "warning": "warning",
    "note":    "notice",
    "none":    "notice",
}


def collect_rules(runs):
    """Build ruleId → {tool, short} map across all runs."""
    rules_by_id = {}
    for run in runs:
        driver = run.get("tool", {}).get("driver", {})
        tool_name = driver.get("name", "tool")
        for rule in driver.get("rules", []) or []:
            rid = rule.get("id", "")
            if not rid:
                continue
            rules_by_id[rid] = {
                "tool":  tool_name,
                "short": rule.get("shortDescription", {}).get("text", ""),
            }
    return rules_by_id


def main():
    # Read all of stdin. Some tools (e.g. SkillSpector --recursive) prepend
    # progress text to stdout before the actual JSON document; the SARIF
    # object then starts partway through. Find the first '{' and parse from
    # there to be robust against that pattern.
    raw = sys.stdin.read()
    start = raw.find("{")
    if start < 0:
        print(
            "::error title=sarif-to-annotations::no JSON object found in input",
            file=sys.stderr,
        )
        sys.exit(2)
    try:
        data = json.loads(raw[start:])
    except json.JSONDecodeError as e:
        print(
            "::error title=sarif-to-annotations::invalid JSON: " + str(e),
            file=sys.stderr,
        )
        sys.exit(2)

    runs = data.get("runs") or []
    if not runs:
        sys.exit(0)

    rules_by_id = collect_rules(runs)

    error_count = 0
    out_lines = []

    for run in runs:
        tool_name = run.get("tool", {}).get("driver", {}).get("name", "tool")
        results = run.get("results") or []
        for result in results:
            level = result.get("level", "warning")
            if level not in LEVEL_MAP:
                level = "warning"
            ann_level = LEVEL_MAP[level]
            if ann_level == "error":
                error_count += 1

            rule_id = result.get("ruleId", "?")
            rule_short = rules_by_id.get(rule_id, {}).get("short", "")
            title = tool_name + "[" + rule_id + "]"

            message = result.get("message", {}).get("text", "(no message)")
            if rule_short and rule_short != message:
                full_msg = rule_short + " — " + message
            else:
                full_msg = message

            # First physical location
            locations = result.get("locations") or []
            file_uri = ""
            start_line = None
            start_col = None
            end_line = None
            end_col = None
            if locations:
                phys = locations[0].get("physicalLocation") or {}
                file_uri = phys.get("artifactLocation", {}).get("uri", "")
                region = phys.get("region") or {}
                start_line = region.get("startLine")
                start_col = region.get("startColumn")
                end_line = region.get("endLine")
                end_col = region.get("endColumn")

            parts = []
            if file_uri:
                parts.append("file=" + file_uri)
            if start_line is not None:
                parts.append("line=" + str(start_line))
            if start_col is not None:
                parts.append("col=" + str(start_col))
            if end_line is not None:
                parts.append("endLine=" + str(end_line))
            if end_col is not None:
                parts.append("endColumn=" + str(end_col))
            parts.append("title=" + title)
            props = ",".join(parts)

            out_lines.append("::" + ann_level + " " + props + "::" + full_msg)

    # Emit to stdout in one go
    sys.stdout.write("\n".join(out_lines))
    if out_lines:
        sys.stdout.write("\n")

    sys.exit(1 if error_count > 0 else 0)


if __name__ == "__main__":
    main()