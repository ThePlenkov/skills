#!/usr/bin/env python3
"""
orchestrate.py — parallel orchestration for the SkillSpector action.

Runs one `skillspector scan` + `emit.py` per skill in parallel,
bounded by `--max-workers` (default: `os.cpu_count()`). Aggregates
counts, merges per-skill SARIF files into a single multi-run SARIF,
writes the final $GITHUB_OUTPUT, and appends to $GITHUB_STEP_SUMMARY.

### Why parallel

  43 skills × ~2s per scan = ~90s sequential on the github-hosted
  runner. With 4 cores that's ~25s in parallel. Skills are independent
  (each is its own directory with its own SKILL.md), so there is no
  correctness cost to scanning them concurrently.

### Why this script (not bash)

  - ProcessPoolExecutor gives us real OS-process parallelism (the
    GIL doesn't apply to the skillspector subprocesses we spawn).
  - Per-skill $GITHUB_OUTPUT writes would race if we let each
    emit.py write directly. Instead emit.py is called with
    --no-step-output; this script is the sole writer of the final
    aggregated outputs.
  - Per-skill SARIF files are written to a tmpdir; this script
    concatenates `runs[]` at the end into a single multi-run SARIF.

### Inputs (env vars, all set by the action's bash step)

  SKILLS_FILE            path to a file listing skill directories, one per line
  EMIT_SCRIPT            path to emit.py
  OUTPUT_DIR             tmpdir for per-skill JSON + SARIF files
  MAX_WORKERS            parallelism (default: os.cpu_count())
  SKILLSPECTOR_ARGS      space-separated args passed to skillspector
                         (e.g. "--no-llm --baseline path/to/file")
  ANNOTATIONS_ENABLED    "true" to emit ::error / ::warning lines
  SARIF_OUT              path to write merged SARIF (empty: skip)
  FAIL_ON_ERROR          "true" to exit 1 on any error-severity finding
  JOB_SUMMARY_ENABLED    "true" to append a per-skill summary table
"""
import concurrent.futures
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def detect_max_workers():
    """Pick a sensible default. Honor MAX_WORKERS env var if set."""
    override = os.environ.get("MAX_WORKERS", "").strip()
    if override:
        try:
            n = int(override)
            if n > 0:
                return n
        except ValueError:
            pass
    return os.cpu_count() or 1


def parse_skillspector_args(arg_string):
    """Split a shell-style arg string into a list, respecting quotes."""
    import shlex
    if not arg_string:
        return []
    try:
        return shlex.split(arg_string)
    except ValueError:
        return arg_string.split()


def run_subprocess(cmd, **kwargs):
    """subprocess.run with text=True and check=False by default."""
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


def process_one_skill(skill_dir):
    """Scan one skill and run emit.py on the result.

    Returns a dict with per-skill counts and exit codes. Writes the
    per-skill JSON and (if SARIF_OUT was set) per-skill SARIF to
    OUTPUT_DIR. Print annotations to stdout as they're produced, so
    they appear in the workflow log in completion order.
    """
    skill = os.path.basename(skill_dir.rstrip("/"))
    output_dir = Path(os.environ["OUTPUT_DIR"])
    json_path = output_dir / f"{skill}.json"
    sarif_path = output_dir / f"{skill}.sarif" if os.environ.get("SARIF_OUT") else None

    # Header line for the per-skill group (matches the old sequential UX)
    print(f"::group::Scanning {skill}", flush=True)

    skillspector_args = parse_skillspector_args(os.environ.get("SKILLSPECTOR_ARGS", ""))

    proc = run_subprocess(
        ["skillspector", "scan", skill_dir, "--format", "json", *skillspector_args],
    )

    json_path.write_text(proc.stdout)

    if not proc.stdout.strip():
        print(f"  (no output — skillspector exit={proc.returncode})", flush=True)
        print("::endgroup::", flush=True)
        return {
            "skill":   skill,
            "errors":  0,
            "warnings": 0,
            "total":   0,
            "ss_exit": proc.returncode,
            "emit_exit": 0,
        }

    doc = json.loads(proc.stdout)
    issues = doc.get("issues") or []
    errors = sum(1 for i in issues if (i.get("severity") or "").upper() in ("HIGH", "CRITICAL"))
    warnings = sum(1 for i in issues if (i.get("severity") or "").upper() in ("MEDIUM", "WARNING"))

    # Build emit.py command
    emit_script = os.environ["EMIT_SCRIPT"]
    emit_cmd = [
        sys.executable, emit_script,
        "--input", str(json_path),
        "--tool-name", "skillspector",
        "--skill-name", skill,
        "--no-step-output",  # orchestrator owns $GITHUB_OUTPUT
    ]
    if os.environ.get("ANNOTATIONS_ENABLED", "true") != "true":
        emit_cmd.append("--no-annotations")
    if sarif_path:
        emit_cmd += ["--sarif-out", str(sarif_path)]
    if os.environ.get("FAIL_ON_ERROR", "true") != "true":
        emit_cmd.append("--no-fail-on-error")
    if os.environ.get("JOB_SUMMARY_ENABLED", "true") == "true":
        emit_cmd.append("--write-summary")

    emit_proc = run_subprocess(emit_cmd)

    # Stream emit.py's stdout (the annotation lines) into our stdout
    # so they appear in the workflow log in completion order.
    sys.stdout.write(emit_proc.stdout)
    sys.stdout.flush()

    print(
        f"  findings={len(issues)} errors={errors} warnings={warnings} "
        f"ss_exit={proc.returncode} emit_exit={emit_proc.returncode}",
        flush=True,
    )
    print("::endgroup::", flush=True)

    return {
        "skill":   skill,
        "errors":  errors,
        "warnings": warnings,
        "total":   len(issues),
        "ss_exit": proc.returncode,
        "emit_exit": emit_proc.returncode,
    }


def aggregate_sarif(output_dir, sarif_out, results):
    """Concatenate per-skill SARIF `runs[]` into one multi-run SARIF."""
    runs = []
    for r in results:
        sarif_file = output_dir / f"{r['skill']}.sarif"
        if not sarif_file.exists():
            continue
        try:
            with sarif_file.open() as f:
                doc = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        for run in doc.get("runs", []) or []:
            runs.append(run)

    merged = {
        "$schema": "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json",
        "version": "2.1.0",
        "runs":    runs,
    }
    Path(sarif_out).write_text(json.dumps(merged, indent=2) + "\n")


def write_step_outputs(total_errors, total_warnings, total, sarif_out):
    gh = os.environ.get("GITHUB_OUTPUT")
    if not gh:
        return
    with open(gh, "a", encoding="utf-8") as f:
        f.write(f"error-count={total_errors}\n")
        f.write(f"warning-count={total_warnings}\n")
        f.write(f"total-count={total}\n")
        if sarif_out:
            f.write(f"sarif-path={sarif_out}\n")


def write_step_summary(results):
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary:
        return
    total_errors = sum(r["errors"] for r in results)
    total_warnings = sum(r["warnings"] for r in results)
    total_findings = sum(r["total"] for r in results)

    lines = [
        "## SkillSpector scan",
        "",
        f"- Total findings: **{total_findings}**",
        f"- Error-severity: **{total_errors}**",
        f"- Warning-severity: {total_warnings}",
        "",
        "| Skill | Errors | Warnings | Total |",
        "| --- | ---:| ---:| ---:|",
    ]
    for r in sorted(results, key=lambda r: r["skill"]):
        lines.append(
            f"| {r['skill']} | {r['errors']} | {r['warnings']} | {r['total']} |"
        )
    with open(summary, "a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    skills_file = os.environ.get("SKILLS_FILE")
    if not skills_file or not Path(skills_file).exists():
        print("::error title=skillspector-orchestrate::SKILLS_FILE not set or missing", file=sys.stderr)
        sys.exit(2)

    with open(skills_file) as f:
        skill_dirs = [line.strip() for line in f if line.strip()]

    if not skill_dirs:
        print("::error title=skillspector-orchestrate::no skills to scan", file=sys.stderr)
        sys.exit(2)

    max_workers = detect_max_workers()
    output_dir = Path(os.environ.get("OUTPUT_DIR") or tempfile.mkdtemp(prefix="skillspector-"))
    output_dir.mkdir(parents=True, exist_ok=True)
    os.environ["OUTPUT_DIR"] = str(output_dir)

    print(f"Discovered {len(skill_dirs)} skill(s); parallelism={max_workers}", flush=True)

    # ProcessPoolExecutor gives us real OS-process parallelism. Each
    # worker spawns its own skillspector subprocess, so the GIL doesn't
    # serialize the actual work.
    results = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=max_workers) as ex:
        # Submit in skill-name order so failures early in the list
        # surface early (but worker assignment is round-robin).
        future_to_skill = {
            ex.submit(process_one_skill, d): d for d in skill_dirs
        }
        for fut in concurrent.futures.as_completed(future_to_skill):
            skill_dir = future_to_skill[fut]
            try:
                results.append(fut.result())
            except Exception as e:
                skill = os.path.basename(skill_dir.rstrip("/"))
                print(f"::error title=skillspector::{skill}: {e}", file=sys.stderr)
                results.append({
                    "skill":   skill,
                    "errors":  0,
                    "warnings": 0,
                    "total":   0,
                    "ss_exit": 1,
                    "emit_exit": 1,
                })

    # Sort results by skill name for deterministic output (counts,
    # summary table, etc.) — completion order is non-deterministic.
    results.sort(key=lambda r: r["skill"])

    total_errors = sum(r["errors"] for r in results)
    total_warnings = sum(r["warnings"] for r in results)
    total_findings = sum(r["total"] for r in results)

    # Merge SARIF if requested
    sarif_out = os.environ.get("SARIF_OUT", "").strip()
    if sarif_out:
        aggregate_sarif(output_dir, sarif_out, results)

    # Final outputs (single writer — safe)
    write_step_outputs(total_errors, total_warnings, total_findings, sarif_out)

    # Job summary
    if os.environ.get("JOB_SUMMARY_ENABLED", "true") == "true":
        write_step_summary(results)

    print(
        f"\n=== Summary ===\n"
        f"Total findings: {total_findings}\n"
        f"Error-severity: {total_errors}\n"
        f"Warning-severity: {total_warnings}",
        flush=True,
    )

    # Decide exit code
    failed = (
        any(r["ss_exit"] != 0 or r["emit_exit"] not in (0, 1) for r in results)
        or (os.environ.get("FAIL_ON_ERROR", "true") == "true" and total_errors > 0)
    )
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()