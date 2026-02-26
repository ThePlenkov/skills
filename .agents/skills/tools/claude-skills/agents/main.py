#!/usr/bin/env python3
"""
Claude Skills Manager Agent

Scans ~/.agents/skills for nested skill directories and creates flat symlinks in ~/.claude/skills.
"""

import os
import sys
from pathlib import Path


def find_skills(base_path: Path) -> list[tuple[str, Path]]:
    """
    Find all skill directories (containing SKILL.md) under base_path.

    Returns list of (skill_name, skill_path) tuples.
    """
    skills = []

    if not base_path.exists():
        return skills

    # Use os.walk with followlinks=True to follow symlinks
    for root, dirs, files in os.walk(base_path, followlinks=True):
        if "SKILL.md" in files:
            skill_dir = Path(root).resolve()

            # Get the relative path from base_path to this skill
            try:
                rel_path = skill_dir.relative_to(base_path.resolve())
                skill_name = str(rel_path).replace(os.sep, "-")
            except ValueError:
                # If we can't get a relative path, use the directory name
                skill_name = skill_dir.name

            skills.append((skill_name, skill_dir))

    return skills


def clean_skill_symlinks(target_dir: Path, dry_run: bool = False):
    """Remove existing skill symlinks (but not the claude-skills directory itself)."""
    if not target_dir.exists():
        return

    for item in target_dir.iterdir():
        # Skip the claude-skills directory itself
        if item.name == "claude-skills":
            continue

        # Only remove symlinks
        if item.is_symlink():
            if dry_run:
                print(f"Would remove: {item}")
            else:
                item.unlink()
                print(f"Removed: {item}")


def create_symlinks(skills: list[tuple[str, Path]], target_dir: Path, dry_run: bool = False):
    """Create symlinks for all found skills."""
    target_dir.mkdir(parents=True, exist_ok=True)

    for skill_name, skill_path in skills:
        # Skip claude-skills to avoid recursion
        if skill_name == "claude-skills":
            continue

        link_path = target_dir / skill_name

        # Check if symlink already exists and points to the same location
        if link_path.exists():
            if link_path.is_symlink() and link_path.resolve() == skill_path.resolve():
                print(f"Already exists: {skill_name} -> {skill_path}")
                continue
            else:
                if dry_run:
                    print(f"Would replace: {skill_name} -> {skill_path}")
                else:
                    link_path.unlink()
                    link_path.symlink_to(skill_path)
                    print(f"Replaced: {skill_name} -> {skill_path}")
        else:
            if dry_run:
                print(f"Would create: {skill_name} -> {skill_path}")
            else:
                link_path.symlink_to(skill_path)
                print(f"Created: {skill_name} -> {skill_path}")


def main():
    # Parse arguments
    dry_run = "--dry-run" in sys.argv
    clean = "--clean" in sys.argv

    # Paths
    home = Path.home()
    agents_skills = home / ".agents" / "skills"
    claude_skills = home / ".claude" / "skills"

    print(f"Scanning for skills in: {agents_skills}")
    print(f"Target directory: {claude_skills}")
    print()

    # Find all skills
    skills = find_skills(agents_skills)

    if not skills:
        print("No skills found.")
        return

    print(f"Found {len(skills)} skill(s):")
    for skill_name, skill_path in skills:
        print(f"  - {skill_name} ({skill_path})")
    print()

    # Clean if requested
    if clean:
        print("Cleaning existing symlinks...")
        clean_skill_symlinks(claude_skills, dry_run)
        print()

    # Create symlinks
    print("Creating symlinks...")
    create_symlinks(skills, claude_skills, dry_run)

    if dry_run:
        print()
        print("Dry run completed. Run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()
