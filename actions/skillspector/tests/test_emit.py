#!/usr/bin/env python3
"""
test_emit.py — unit tests for emit.py.

Run with:
    python3 -m unittest actions/skillspector/tests/test_emit.py

Or directly:
    python3 actions/skillspector/tests/test_emit.py
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


HERE = Path(__file__).parent
ROOT = HERE.parent
SYNTH = HERE / "fixtures" / "synthetic.json"
ACT = HERE / "fixtures" / "act-scan.json"
EMIT = ROOT / "scripts" / "emit.py"


def run_emit(args, stdin_text=None):
    """Run emit.py with the given argv; return (returncode, stdout, stderr)."""
    proc = subprocess.run(
        [sys.executable, str(EMIT), *args],
        input=stdin_text,
        capture_output=True,
        text=True,
    )
    return proc.returncode, proc.stdout, proc.stderr


class TestAnnotationMode(unittest.TestCase):
    """Annotations only — no SARIF file."""

    def test_emits_one_line_per_issue(self):
        rc, out, _ = run_emit(["--input", str(SYNTH)])
        self.assertEqual(rc, 1)  # has HIGH → error → exit 1
        # 2 issues → 2 annotation lines (no header/footer)
        self.assertEqual(len([ln for ln in out.splitlines() if ln.startswith("::")]), 2)

    def test_title_contains_tag_prefix(self):
        _, out, _ = run_emit(["--input", str(SYNTH)])
        # First issue has tag "ASI02"
        self.assertIn("[ASI02]skillspector[LP3]: MCP Least Privilege", out)
        # Second issue has tags "ASI01" and "AS3"
        self.assertIn("[ASI01 AS3]skillspector[AS3]: Agent Snooping", out)

    def test_message_has_fix_and_confidence(self):
        _, out, _ = run_emit(["--input", str(SYNTH)])
        self.assertIn("Fix: Add a 'permissions' field to SKILL.md.", out)
        self.assertIn("confidence=70", out)
        self.assertIn("confidence=90", out)

    def test_message_has_code_snippet(self):
        _, out, _ = run_emit(["--input", str(SYNTH)])
        # Second issue has code_snippet "/** x */"
        self.assertIn("Code: /** x */", out)

    def test_intent_shown_first(self):
        _, out, _ = run_emit(["--input", str(SYNTH)])
        # Second issue has intent "list skills"
        # Locate the AS3 annotation and check that "Intent: list skills" comes
        # before "Skill enumerates other skills."
        as3_line = next(ln for ln in out.splitlines() if "AS3" in ln)
        intent_pos = as3_line.find("Intent: list skills")
        expl_pos = as3_line.find("Skill enumerates other skills")
        self.assertGreater(intent_pos, -1)
        self.assertGreater(expl_pos, intent_pos)

    def test_severity_to_gh_command(self):
        _, out, _ = run_emit(["--input", str(SYNTH)])
        # LP3 is MEDIUM → warning
        self.assertIn("::warning file=SKILL.md", out)
        # AS3 is HIGH → error
        self.assertIn("::error file=scripts/x.ts", out)

    def test_percents_escaped(self):
        # No literal '%' should appear in the user-data portion of the
        # annotation message (they'd be double-escaped by GitHub).
        _, out, _ = run_emit(["--input", str(SYNTH)])
        for line in out.splitlines():
            if line.startswith("::"):
                # '::warning file=...::MESSAGE' — the MESSAGE is after the second ::
                msg = line.split("::", 2)[2]
                self.assertNotIn("%", msg, msg="literal % in message: " + msg)

    def test_no_annotations_flag(self):
        # --no-annotations suppresses the workflow-command output
        # (stdout) but the error-severity gate still fires — exit 1
        # because the synthetic fixture has a HIGH finding.
        rc, out, _ = run_emit(["--input", str(SYNTH), "--no-annotations"])
        self.assertEqual(rc, 1)
        self.assertEqual(out, "")

    def test_no_annotations_no_errors(self):
        # Same flag with a clean input → exit 0, no output.
        rc, out, _ = run_emit(["--input", str(ACT), "--no-annotations"])
        self.assertEqual(rc, 0)
        self.assertEqual(out, "")

    def test_no_fail_on_error(self):
        # Default would exit 1 because of HIGH. With --no-fail-on-error, exit 0.
        rc, _, _ = run_emit(["--input", str(SYNTH), "--no-fail-on-error"])
        self.assertEqual(rc, 0)


class TestSarifMode(unittest.TestCase):
    """SARIF output — files only, no annotations."""

    def test_sarif_is_valid(self):
        with tempfile.TemporaryDirectory() as tmp:
            sarif = Path(tmp) / "out.sarif"
            rc, out, _ = run_emit([
                "--input", str(SYNTH),
                "--no-annotations",
                "--sarif-out", str(sarif),
            ])
            self.assertEqual(rc, 1)  # has HIGH → exit 1
            self.assertTrue(sarif.exists())
            with sarif.open() as f:
                doc = json.load(f)
            self.assertEqual(doc["version"], "2.1.0")
            self.assertEqual(len(doc["runs"]), 1)
            self.assertEqual(len(doc["runs"][0]["results"]), 2)

    def test_sarif_preserves_properties(self):
        with tempfile.TemporaryDirectory() as tmp:
            sarif = Path(tmp) / "out.sarif"
            run_emit([
                "--input", str(SYNTH),
                "--no-annotations",
                "--sarif-out", str(sarif),
            ])
            with sarif.open() as f:
                doc = json.load(f)
            r0 = doc["runs"][0]["results"][0]
            self.assertIn("properties", r0)
            self.assertEqual(r0["properties"]["category"], "MCP Least Privilege")
            self.assertEqual(r0["properties"]["confidence"], 0.7)
            self.assertIn("ASI02", r0["properties"]["tags"])

    def test_sarif_rule_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            sarif = Path(tmp) / "out.sarif"
            run_emit([
                "--input", str(SYNTH),
                "--no-annotations",
                "--sarif-out", str(sarif),
            ])
            with sarif.open() as f:
                doc = json.load(f)
            rules = doc["runs"][0]["tool"]["driver"]["rules"]
            self.assertEqual({r["id"] for r in rules}, {"LP3", "AS3"})
            lp3 = next(r for r in rules if r["id"] == "LP3")
            self.assertEqual(lp3["shortDescription"]["text"], "MCP Least Privilege")
            self.assertIn("help", lp3)
            self.assertIn("Add a 'permissions'", lp3["help"]["text"])


class TestDualMode(unittest.TestCase):
    """Both annotations and SARIF in one pass — the most common CI use."""

    def test_both_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            sarif = Path(tmp) / "out.sarif"
            rc, out, _ = run_emit([
                "--input", str(SYNTH),
                "--sarif-out", str(sarif),
            ])
            self.assertEqual(rc, 1)  # HIGH → exit 1
            self.assertTrue(sarif.exists())
            self.assertIn("::warning", out)
            self.assertIn("::error", out)


class TestInputHandling(unittest.TestCase):
    """stdin / file / progress-text-prefix handling."""

    def test_stdin_input(self):
        rc, out, _ = run_emit(
            [],
            stdin_text=SYNTH.read_text(),
        )
        self.assertEqual(rc, 1)
        self.assertIn("::warning", out)

    def test_progress_text_prefix_tolerated(self):
        prefixed = "Progress: scanning...\n" + SYNTH.read_text()
        rc, out, _ = run_emit([], stdin_text=prefixed)
        self.assertEqual(rc, 1)
        self.assertIn("::warning", out)

    def test_invalid_json_exits_2(self):
        rc, _, err = run_emit([], stdin_text="not json at all")
        self.assertEqual(rc, 2)
        self.assertIn("no JSON object found", err)

    def test_empty_input_exits_2(self):
        rc, _, err = run_emit([], stdin_text="")
        self.assertEqual(rc, 2)
        self.assertIn("no JSON object", err)


class TestStepOutputs(unittest.TestCase):
    """GITHUB_OUTPUT handling — write a fake output file, point GITHUB_OUTPUT at it."""

    def test_writes_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            gh = Path(tmp) / "gh_output"
            gh.write_text("")
            env = {**os.environ, "GITHUB_OUTPUT": str(gh)}
            proc = subprocess.run(
                [sys.executable, str(EMIT), "--input", str(SYNTH)],
                capture_output=True, text=True, env=env,
            )
            self.assertEqual(proc.returncode, 1)  # HIGH → exit 1
            content = gh.read_text()
            self.assertIn("error-count=1", content)  # 1 HIGH
            self.assertIn("warning-count=1", content)  # 1 MEDIUM
            self.assertIn("total-count=2", content)

    def test_sarif_path_in_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            gh = Path(tmp) / "gh_output"
            gh.write_text("")
            sarif = Path(tmp) / "out.sarif"
            env = {**os.environ, "GITHUB_OUTPUT": str(gh)}
            proc = subprocess.run(
                [sys.executable, str(EMIT),
                 "--input", str(SYNTH),
                 "--no-annotations",
                 "--sarif-out", str(sarif)],
                capture_output=True, text=True, env=env,
            )
            # Exit 1 is expected (HIGH severity) — we only care that
            # the SARIF was written and the GITHUB_OUTPUT line was set.
            self.assertEqual(proc.returncode, 1)
            self.assertIn("sarif-path=" + str(sarif), gh.read_text())


class TestRealScan(unittest.TestCase):
    """End-to-end with the saved real scan of `.agents/skills/act/`."""

    def test_real_scan_emits_annotations(self):
        rc, out, _ = run_emit(["--input", str(ACT)])
        self.assertEqual(rc, 0)  # act has no HIGH/CRITICAL — only MEDIUM
        self.assertIn("::warning", out)
        self.assertNotIn("::error", out)

    def test_real_scan_writes_sarif(self):
        with tempfile.TemporaryDirectory() as tmp:
            sarif = Path(tmp) / "out.sarif"
            run_emit(["--input", str(ACT), "--no-annotations", "--sarif-out", str(sarif)])
            with sarif.open() as f:
                doc = json.load(f)
            self.assertGreater(len(doc["runs"][0]["results"]), 0)
            for r in doc["runs"][0]["results"]:
                self.assertIn("properties", r)
                self.assertIn("category", r["properties"])


if __name__ == "__main__":
    unittest.main()