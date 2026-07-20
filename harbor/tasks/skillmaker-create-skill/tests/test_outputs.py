"""Verifier for skillmaker-create-skill task."""
import os
import re
from pathlib import Path

import yaml

WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "/workspace"))
SKILL_PATH = WORKSPACE / "skills" / "testing" / "test-http-check" / "SKILL.md"
RESERVED_NAMES_SCRIPT = WORKSPACE / "scripts" / "reserved-names.sh"


def _load_reserved_names(path: Path) -> set[str]:
    """Load the reserved-name set from the bash array shipped in the task."""
    text = path.read_text()
    return set(re.findall(r'^\s*"([^"]+)"', text, re.MULTILINE))


if RESERVED_NAMES_SCRIPT.exists():
    RESERVED_NAMES = _load_reserved_names(RESERVED_NAMES_SCRIPT)
else:
    # Minimal fallback so the verifier does not crash if the script is missing.
    RESERVED_NAMES = {
        "act", "adhd", "atlassian", "codacy", "codescene", "critical-thinking",
        "deepwiki", "docker-agent", "dotagents", "drill", "evidence",
        "gh-stack", "github", "github-fix-main", "github-pr-review", "gitlab",
        "gitlab-ci-local", "glab", "glean", "investigate-first",
        "minimal-root-cause", "mr-address-review", "npm-publish", "one-shot-patch",
        "persistent-memory", "refactoring", "retrospect", "safeguard", "salvage",
        "sarif-to-annotations", "save-session", "skillmaker", "subagent-capsule",
        "triage-issue",
    }


def parse_skill(path: Path):
    text = path.read_text()
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    assert match, "SKILL.md must start with YAML frontmatter delimited by ---"
    frontmatter = yaml.safe_load(match.group(1))
    assert isinstance(frontmatter, dict), "SKILL.md frontmatter is not a valid YAML mapping"
    body = match.group(2)
    return frontmatter, body


def test_skill_file_exists():
    assert SKILL_PATH.exists(), f"Skill file not found: {SKILL_PATH}"


def _name_from_frontmatter(path: Path) -> str:
    frontmatter, _ = parse_skill(path)
    name = frontmatter.get("name")
    assert name is not None, "Missing required frontmatter key: name"
    assert isinstance(name, str) and name.strip(), "Skill name must be a non-empty string"
    return name.strip()


def test_name_matches():
    name = _name_from_frontmatter(SKILL_PATH)
    assert name == "test-http-check", f"Expected name 'test-http-check', got {name!r}"


def test_kebab_case_name():
    name = _name_from_frontmatter(SKILL_PATH)
    assert re.fullmatch(r"^[a-z0-9]+(-[a-z0-9]+)*$", name), f"Name is not kebab-case: {name}"


def test_not_reserved():
    name = _name_from_frontmatter(SKILL_PATH)
    assert name not in RESERVED_NAMES, f"Name conflicts with reserved name: {name}"


def test_frontmatter_has_required_fields():
    frontmatter, _ = parse_skill(SKILL_PATH)
    for key in ("name", "description", "allowed-tools"):
        assert key in frontmatter, f"Missing required frontmatter key: {key}"
        value = frontmatter[key]
        assert value is not None and str(value).strip(), (
            f"Required frontmatter value for '{key}' is empty or null"
        )


def test_body_has_procedure():
    _, body = parse_skill(SKILL_PATH)
    lowered = body.lower()
    assert "http" in lowered, "Body should mention HTTP"
    assert "curl" in lowered, "Body should mention curl"
    assert len(body.strip()) > 50, "Body is too short"
    assert re.search(r"^(\d+\.|-)\s+.*curl", body, re.MULTILINE), (
        "Body should include a curl command as a numbered or bulleted procedure step"
    )
