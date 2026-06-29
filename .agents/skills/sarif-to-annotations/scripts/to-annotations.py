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

Enrichment from SARIF `properties`:
  When a result carries `properties` (typical for tools like
  SkillSpector that round-trip through JSON→SARIF wrappers), we use
  them to make the annotation more useful:

    properties.category      → appended to the annotation title
    properties.tags          → prefix in the title
    properties.confidence    → " (confidence NN%)" suffix
    properties.remediation   → " — Fix: …" suffix
    properties.code_snippet  → truncated and appended as a quote
    properties.intent        → "Intent: …" prefix in the message
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
    """Build ruleId → {tool, short, full, help} map across all runs."""
    rules_by_id = {}
    for run in runs:
        driver = run.get("tool", {}).get("driver", {})
        tool_name = driver.get("name", "tool")
        for rule in driver.get("rules", []) or []:
            rid = rule.get("id", "")
            if not rid:
                continue
            help_obj = rule.get("help") or {}
            rules_by_id[rid] = {
                "tool":  tool_name,
                "short": rule.get("shortDescription", {}).get("text", ""),
                "full":  rule.get("fullDescription", {}).get("text", ""),
                "help":  help_obj.get("text", ""),
            }
    return rules_by_id


def build_title(tool_name, rule_id, properties, rules_by_id):
    """Build a richer annotation title.

    Form: <tags?> <tool>[<rule>]: <category or rule name>

    Tags (e.g. OWASP ASI02, CWE-22) come first so they're visible at a
    glance. Tool and ruleId are the canonical identifier. Category is
    a human-readable name; falls back to the rule's shortDescription
    from the SARIF driver.
    """
    parts = []

    tags = (properties or {}).get("tags") or []
    if tags:
        # Deduplicate while preserving order. Some tools put the same
        # category name in both `category` and `tags`, so dedup is real.
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
    if not category:
        rule = rules_by_id.get(rule_id, {})
        category = rule.get("short") or rule.get("full")
    if category:
        parts.append(": " + category)

    return "".join(parts)


def build_message(explanation, properties):
    """Compose the annotation message body from explanation + properties.

    Order:
      1. Intent       (what the skill/code is trying to do)
      2. Explanation  (the finding itself)
      3. Fix          (remediation advice)
      4. Code snippet (truncated; omitted if too long)
      5. Confidence   ("(confidence NN%)")
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
        # Truncate long snippets so the annotation stays scannable.
        # GitHub annotation messages render fine up to a few hundred
        # chars; beyond that they get visually clipped in the diff.
        max_len = 400
        flat = snippet.replace("\n", " ⏎ ")
        if len(flat) > max_len:
            flat = flat[: max_len - 1] + "…"
        out.append("Code: " + flat)

    confidence = (properties or {}).get("confidence")
    if confidence is not None:
        try:
            pct = int(round(float(confidence) * 100))
            # We avoid the literal '%' here on purpose: the final
            # message is escaped (`%` → `%25`) before being emitted as
            # a GitHub workflow command. If we added `70%` here, the
            # escape would produce `70%25` and GitHub would render
            # `70%25` instead of `70%`. Using `=` and stripping the
            # percent keeps the output honest.
            out.append("confidence=" + str(pct))
        except (TypeError, ValueError):
            pass

    return " — ".join(out)


def main():
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
            properties = result.get("properties") or {}
            message = result.get("message", {}).get("text", "(no message)")

            title = build_title(tool_name, rule_id, properties, rules_by_id)
            full_msg = build_message(message, properties)

            # Get first physical location
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

            safe_msg = (
                full_msg
                .replace("%", "%25")
                .replace("\r", " ")
                .replace("\n", " ")
            )
            out_lines.append("::" + ann_level + " " + props + "::" + safe_msg)

    sys.stdout.write("\n".join(out_lines))
    if out_lines:
        sys.stdout.write("\n")

    sys.exit(1 if error_count > 0 else 0)


if __name__ == "__main__":
    main()