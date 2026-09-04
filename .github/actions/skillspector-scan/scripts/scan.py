#!/usr/bin/env python3
"""SkillSpector scan runner for GitHub Actions.

Discovers SKILL.md targets, runs SkillSpector on each, merges reports,
and writes GitHub Actions outputs + step summary.
"""
from __future__ import annotations

import fnmatch
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Iterable

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SEVERITY_RANK = {
    "none": 0, "info": 1, "note": 1, "low": 2, "warning": 2,
    "medium": 3, "error": 3, "high": 4, "critical": 5,
}


def env_bool(key: str, default: str = "false") -> bool:
    return os.environ.get(key, default).strip().lower() in {"1", "true", "yes", "on"}


def env_list(key: str) -> list[str]:
    raw = os.environ.get(key, "")
    return [p.strip() for p in raw.replace(",", "\n").splitlines() if p.strip()]


def env_int(key: str) -> int | None:
    val = os.environ.get(key, "").strip()
    return int(val) if val else None


def normalize_severity(severity: Any) -> str:
    s = str(severity or "none").strip().lower()
    return s if s in SEVERITY_RANK else "none"


def highest_severity(severities: Iterable[str]) -> str:
    best = "none"
    for s in severities:
        n = normalize_severity(s)
        if SEVERITY_RANK.get(n, 0) > SEVERITY_RANK[best]:
            best = n
    return best


# ---------------------------------------------------------------------------
# Skill discovery
# ---------------------------------------------------------------------------

def discover_skills(root: Path, excludes: tuple[str, ...] = ()) -> list[Path]:
    """Find all directories containing SKILL.md under root."""
    if root.is_file():
        return [] if _is_excluded(root, root.parent, excludes) else [root]
    targets = []
    for skill_md in root.rglob("SKILL.md"):
        skill_dir = skill_md.parent
        if not _is_excluded(skill_dir, root, excludes) and not _is_excluded(skill_md, root, excludes):
            targets.append(skill_dir)
    return sorted(set(targets), key=lambda p: p.as_posix())


def changed_skill_targets(root: Path, excludes: tuple[str, ...] = ()) -> list[Path] | None:
    """Detect changed skills from PR git diff. Returns None if not a PR."""
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")
    event_path = os.environ.get("GITHUB_EVENT_PATH", "")
    if event_name not in {"pull_request", "pull_request_target"} or not event_path:
        return None

    workspace = Path(os.environ.get("GITHUB_WORKSPACE", "."))
    try:
        event = json.loads(Path(event_path).read_text(encoding="utf-8"))
        base_sha = event["pull_request"]["base"]["sha"]
    except (OSError, KeyError, json.JSONDecodeError):
        return None

    # Fetch base ref for diff
    try:
        subprocess.run(
            ["git", "fetch", "--no-tags", "--depth=1", "origin", base_sha],
            cwd=workspace, capture_output=True, text=True, check=False,
        )
    except Exception:
        pass

    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "--diff-filter=ACMR", f"{base_sha}...HEAD"],
            cwd=workspace, capture_output=True, text=True, check=True,
        )
    except subprocess.CalledProcessError:
        return None

    changed = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if not changed:
        return []

    # Map changed files to owning skill directories
    root_resolved = root.resolve()
    targets: set[Path] = set()
    for f in changed:
        p = (workspace / f).resolve()
        # Walk up to find SKILL.md
        current = p if p.is_dir() else p.parent
        while True:
            if (current / "SKILL.md").exists():
                if not _is_excluded(current, root, excludes):
                    targets.add(current)
                break
            if current == workspace or current.parent == current:
                break
            current = current.parent

    return sorted(targets, key=lambda p: p.as_posix())


def _is_excluded(path: Path, root: Path, patterns: tuple[str, ...]) -> bool:
    if not patterns:
        return False
    try:
        rel = path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        rel = path.as_posix()
    return any(fnmatch.fnmatch(rel, p) or fnmatch.fnmatch(path.name, p) for p in patterns)


# ---------------------------------------------------------------------------
# SkillSpector execution
# ---------------------------------------------------------------------------

def run_skillspector(target: Path, work_dir: Path, use_llm: bool, baseline: Path | None) -> dict[str, Any]:
    """Run SkillSpector on a single target, return merged JSON+SARIF dict."""
    name = hashlib.sha1(str(target).encode()).hexdigest()[:12]
    json_path = work_dir / f"{name}.json"
    sarif_path = work_dir / f"{name}.sarif"

    cmd = ["skillspector", "scan", str(target), "--no-llm"] if not use_llm else ["skillspector", "scan", str(target)]
    if baseline:
        cmd += ["--baseline", str(baseline)]

    # JSON report
    subprocess.run(
        [*cmd, "--format", "json", "--output", str(json_path)],
        check=True, capture_output=True, text=True,
    )
    # SARIF report
    subprocess.run(
        [*cmd, "--format", "sarif", "--output", str(sarif_path)],
        check=True, capture_output=True, text=True,
    )

    return {
        "json": json.loads(json_path.read_text(encoding="utf-8")) if json_path.exists() else {},
        "sarif": json.loads(sarif_path.read_text(encoding="utf-8")) if sarif_path.exists() else {"runs": []},
    }


# ---------------------------------------------------------------------------
# Report merging
# ---------------------------------------------------------------------------

def merge_json_reports(reports: list[dict[str, Any]]) -> dict[str, Any]:
    findings: list[dict[str, Any]] = []
    scores: list[int] = []
    severities: list[str] = []

    for report in reports:
        scores.append(_risk_score(report))
        severities.append(report.get("risk_severity") or report.get("severity") or "none")
        findings.extend(_extract_findings(report))

    return {
        "version": 1,
        "generated_by": "skillspector-scan-action",
        "scanned_count": len(reports),
        "findings_count": len(findings),
        "risk_score": max(scores, default=0),
        "risk_severity": highest_severity([*severities, *(f.get("severity", "none") for f in findings)]),
        "findings": findings,
        "reports": reports,
    }


def merge_sarif_reports(reports: list[dict[str, Any]]) -> dict[str, Any]:
    rules_by_id: dict[str, dict[str, Any]] = {}
    results: list[dict[str, Any]] = []
    driver_name = "SkillSpector"

    for report in reports:
        for run in report.get("runs", []):
            drv = run.get("tool", {}).get("driver", {})
            if drv.get("name"):
                driver_name = drv["name"]
            for rule in drv.get("rules", []):
                rid = str(rule.get("id") or rule.get("ruleId") or "")
                if rid and rid not in rules_by_id:
                    rules_by_id[rid] = rule
            results.extend(run.get("results", []))

    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {"driver": {"name": driver_name, "rules": [rules_by_id[k] for k in sorted(rules_by_id)]}},
            "results": results,
        }],
    }


def render_markdown(summary: dict[str, Any]) -> str:
    lines = [
        "## SkillSpector Scan Summary",
        "",
        f"| Metric | Value |",
        f"|---|---|",
        f"| Scanned skills | {summary.get('scanned_count', 0)} |",
        f"| Findings | {summary.get('findings_count', 0)} |",
        f"| Risk score | {summary.get('risk_score', 0)}/100 |",
        f"| Risk severity | `{summary.get('risk_severity', 'none')}` |",
        "",
    ]
    findings = summary.get("findings", [])
    if findings:
        lines += ["### Findings", ""]
        for f in findings[:50]:  # Cap at 50 for step summary
            rid = f.get("rule_id") or f.get("ruleId") or "unknown"
            sev = normalize_severity(f.get("severity"))
            msg = f.get("message") or f.get("description") or ""
            path = f.get("path") or ""
            lines.append(f"- **{sev}** `{rid}` — {path}: {msg}")
        if len(findings) > 50:
            lines.append(f"\n_...and {len(findings) - 50} more — see JSON report._")
        lines.append("")
    return "\n".join(lines)


def _risk_score(report: dict[str, Any]) -> int:
    try:
        return int(report.get("risk_score", report.get("score", 0)))
    except (TypeError, ValueError):
        return 0


def _extract_findings(report: dict[str, Any]) -> list[dict[str, Any]]:
    f = report.get("filtered_findings")
    if f is None:
        f = report.get("findings")
    return [x for x in (f or []) if isinstance(x, dict)]


# ---------------------------------------------------------------------------
# Gate logic
# ---------------------------------------------------------------------------

def should_fail(summary: dict[str, Any], fail_on: str, min_score: int | None) -> bool:
    score = int(summary.get("risk_score", 0) or 0)
    severity = normalize_severity(summary.get("risk_severity"))
    if min_score is not None and score >= min_score:
        return True
    if fail_on == "high" and severity in {"high", "critical"}:
        return True
    if fail_on == "critical" and severity == "critical":
        return True
    return False


# ---------------------------------------------------------------------------
# GitHub Actions output
# ---------------------------------------------------------------------------

def write_outputs(summary: dict[str, Any], json_path: Path, sarif_path: Path, md_path: Path) -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if not out:
        return
    values = {
        "json": str(json_path),
        "sarif": str(sarif_path),
        "markdown": str(md_path),
        "risk-score": str(summary.get("risk_score", 0)),
        "risk-severity": str(summary.get("risk_severity", "none")),
        "findings-count": str(summary.get("findings_count", 0)),
        "scanned-count": str(summary.get("scanned_count", 0)),
    }
    with Path(out).open("a", encoding="utf-8") as f:
        for k, v in values.items():
            f.write(f"{k}={v}\n")


def write_step_summary(markdown: str) -> None:
    p = os.environ.get("GITHUB_STEP_SUMMARY")
    if p:
        Path(p).write_text(markdown + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    workspace = Path(os.environ.get("GITHUB_WORKSPACE", "."))
    scan_path = Path(os.environ.get("INPUT_PATH", "."))
    if not scan_path.is_absolute():
        scan_path = workspace / scan_path

    excludes = tuple(env_list("INPUT_EXCLUDE"))
    use_llm = env_bool("INPUT_LLM", "false")
    changed_only = env_bool("INPUT_CHANGED_ONLY", "false")
    fail_on = os.environ.get("INPUT_FAIL_ON", "none").strip().lower() or "none"
    min_score = env_int("INPUT_MIN_SCORE")
    baseline_raw = os.environ.get("INPUT_BASELINE", "").strip()
    baseline = Path(baseline_raw) if baseline_raw else None

    # Discover targets
    if changed_only:
        targets = changed_skill_targets(scan_path, excludes)
        if targets is None:
            targets = discover_skills(scan_path, excludes)
    else:
        targets = discover_skills(scan_path, excludes)

    if not targets:
        print("No skills to scan.")
        # Write empty outputs
        out_dir = Path(tempfile.mkdtemp(prefix="skillspector-"))
        json_p = out_dir / "results.json"
        sarif_p = out_dir / "results.sarif"
        md_p = out_dir / "summary.md"
        empty = {"version": 1, "scanned_count": 0, "findings_count": 0, "risk_score": 0, "risk_severity": "none", "findings": []}
        json_p.write_text(json.dumps(empty, indent=2), encoding="utf-8")
        sarif_p.write_text(json.dumps({"$schema": "https://json.schemastore.org/sarif-2.1.0.json", "version": "2.1.0", "runs": [{"tool": {"driver": {"name": "SkillSpector", "rules": []}}, "results": []}]}, indent=2), encoding="utf-8")
        md_p.write_text("## SkillSpector Scan Summary\n\n_No skills to scan._\n", encoding="utf-8")
        write_outputs(empty, json_p, sarif_p, md_p)
        write_step_summary(md_p.read_text(encoding="utf-8"))
        return 0

    print(f"Scanning {len(targets)} skill(s)...")
    for t in targets:
        print(f"  - {t.relative_to(workspace) if t.is_relative_to(workspace) else t}")

    # Run scans
    json_reports: list[dict[str, Any]] = []
    sarif_reports: list[dict[str, Any]] = []

    with tempfile.TemporaryDirectory(prefix="skillspector-scan-") as tmp:
        work_dir = Path(tmp)
        for target in targets:
            print(f"\n--- Scanning {target.name} ---")
            result = run_skillspector(target, work_dir, use_llm, baseline)
            json_reports.append(result["json"])
            sarif_reports.append(result["sarif"])

    # Merge
    summary = merge_json_reports(json_reports)
    sarif = merge_sarif_reports(sarif_reports)
    markdown = render_markdown(summary)

    # Write reports
    out_dir = workspace / "skillspector-results"
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "results.json"
    sarif_path = out_dir / "results.sarif"
    md_path = out_dir / "summary.md"
    json_path.write_text(json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8")
    sarif_path.write_text(json.dumps(sarif, indent=2, sort_keys=True), encoding="utf-8")
    md_path.write_text(markdown, encoding="utf-8")

    write_outputs(summary, json_path, sarif_path, md_path)
    write_step_summary(markdown)

    print(f"\nResults: {summary['findings_count']} findings, risk={summary['risk_score']}/100, severity={summary['risk_severity']}")
    print(f"Reports: {json_path}, {sarif_path}, {md_path}")

    return 1 if should_fail(summary, fail_on, min_score) else 0


if __name__ == "__main__":
    sys.exit(main())
