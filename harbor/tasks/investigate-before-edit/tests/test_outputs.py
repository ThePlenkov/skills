"""Verifier for investigate-before-edit task."""
import hashlib
import os
from pathlib import Path

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "/workspace"))
REPORT = WORKSPACE / "investigation_report.md"
SRC_FILE = WORKSPACE / "src" / "greet.py"
TEST_FILE = WORKSPACE / "tests" / "test_greet.py"

REQUIRED_SECTIONS = [
    "Investigation target",
    "Evidence found",
    "Likely cause",
    "Files relevant to patch",
    "Suggested next step",
    "Commands run",
]


def _hash_file(path: Path) -> str | None:
    if not path.exists():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_source_files_unchanged():
    original_src_hash = _hash_file(SRC_FILE)
    original_test_hash = _hash_file(TEST_FILE)
    assert original_src_hash is not None, f"Source file not found: {SRC_FILE}"
    assert original_test_hash is not None, f"Test file not found: {TEST_FILE}"

    current_src_hash = _hash_file(SRC_FILE)
    current_test_hash = _hash_file(TEST_FILE)
    assert current_src_hash == original_src_hash, "src/greet.py was edited"
    assert current_test_hash == original_test_hash, "tests/test_greet.py was edited"


def test_report_exists():
    assert REPORT.exists(), f"Investigation report not found: {REPORT}"


def test_report_has_required_sections():
    text = REPORT.read_text()
    for section in REQUIRED_SECTIONS:
        assert section in text, f"Report is missing required section: {section}"


def test_report_identifies_bug():
    text = REPORT.read_text().lower()
    assert "world" in text or "name" in text or "argument" in text, (
        "Report should mention the hardcoded 'World' string or the ignored name argument"
    )
