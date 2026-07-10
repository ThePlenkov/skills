#!/usr/bin/env python3
"""
validate.py — runtime cross-check for evidence.claim.v1.

For every claim.json passed on the command line, verifies that every
assertions[].evidence_quote appears verbatim in at least one of:
  - commands[*].stdout_excerpt
  - commands[*].stderr_excerpt
  - The on-disk file at artifacts[].path (read in full)
  - For kind=log artifacts, also artifacts[].content_excerpt (if present)

This catches the failure mode the schema alone cannot: a structurally
valid claim.json that cites a quote that was never actually captured.

Exit 0 when every quote is found, 1 when any is missing.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Iterable


# Filesystem roots that a claim.json is allowed to reference. The intent is
# to block path-traversal exfiltration: a malicious claim could otherwise
# point artifacts[].path at /etc/passwd, ~/.ssh/id_rsa, etc. and have the
# file contents surface in this script's stdout (which is shared in CI
# logs / PR comments).
#
# A path is considered safe if, after resolution, it lies within
#   (a) the claim directory itself, OR
#   (b) the current working directory itself.
#
# We deliberately do NOT walk up to the filesystem root — that would
# re-allow /etc/passwd via "everything is inside /". The agent can still
# reference the project tree by using a relative path from the claim dir.
def is_safe_path(resolved: Path, claim_dir: Path, cwd: Path) -> bool:
    """True iff `resolved` is a descendant of claim_dir or cwd (after
    resolution, which follows symlinks and `..` segments). `resolved` is
    expected to be the result of `Path(...).resolve(strict=False)`."""
    try:
        resolved.relative_to(claim_dir.resolve())
        return True
    except ValueError:
        pass
    try:
        resolved.relative_to(cwd.resolve())
        return True
    except ValueError:
        pass
    return False


def load_text(path: Path) -> str:
    """Read a text file. Returns '' if it does not exist or is unreadable."""
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except (OSError, IsADirectoryError):
        return ""


def check_claim(claim_path: Path, claim_dir: Path) -> list[str]:
    """Return a list of error messages for this claim (empty = OK)."""
    errors: list[str] = []
    try:
        claim = json.loads(claim_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return [f"  invalid JSON: {e}"]

    commands = claim.get("commands", [])
    artifacts = claim.get("artifacts", [])
    assertions = claim.get("assertions", [])

    # Pre-load all command excerpts
    command_blobs: list[tuple[str, str]] = []  # (source, text)
    for i, c in enumerate(commands):
        for field in ("stdout_excerpt", "stderr_excerpt"):
            blob = c.get(field) or ""
            if blob:
                command_blobs.append((f"commands[{i}].{field}", blob))

    # Pre-load all artifact files (read from disk relative to claim_dir).
    # Path-traversal check: reject any artifacts[].path that resolves
    # outside the project tree (claim_dir or cwd or their ancestors).
    artifact_blobs: list[tuple[str, str]] = []
    cwd = Path.cwd()
    for a in artifacts:
        path = a.get("path") or ""
        if not path:
            continue
        # Resolve the path the same way the OS would: relative paths
        # resolve against the claim directory; absolute paths stay as-is.
        # `.resolve(strict=False)` follows symlinks and `..` segments.
        try:
            abs_path = ((claim_dir / path).resolve(strict=False) if not os.path.isabs(path)
                        else Path(path).resolve(strict=False))
        except (OSError, RuntimeError) as e:
            errors.append(f"  artifact path={path!r}: cannot resolve ({e})")
            continue
        if not is_safe_path(abs_path, claim_dir, cwd):
            errors.append(
                f"  artifact path={path!r} resolves to {abs_path!s} which is "
                f"outside the project tree (claim_dir={claim_dir!s}, cwd={cwd!s}); "
                f"refusing to read it (path-traversal guard)"
            )
            continue
        text = load_text(abs_path)
        if text:
            artifact_blobs.append((f"artifact:{path}", text))
        # Also accept the inlined content_excerpt as a valid source.
        ce = a.get("content_excerpt")
        if ce:
            artifact_blobs.append((f"artifact:{path}.content_excerpt", ce))

    # Cross-check every assertion
    for i, a in enumerate(assertions):
        name = a.get("name", f"assertion[{i}]")
        quote = a.get("evidence_quote") or ""
        if not quote:
            errors.append(f"  assertion[{i}] {name!r}: empty evidence_quote")
            continue

        # Quote must appear verbatim in at least one source. Each non-empty
        # line of the quote must be a whole line in the source blob (we split
        # the source on newlines and require a complete-line match, not just a
        # substring match). This catches whitespace drift like
        # 'typecheck: 0 errors' vs ' typecheck: 0 errors' that a pure
        # substring check would miss.
        quote_lines = [ln for ln in quote.splitlines() if ln.strip()]
        if not quote_lines:
            errors.append(f"  assertion[{i}] {name!r}: evidence_quote has no non-empty line")
            continue

        found_in: list[str] = []
        for src, blob in command_blobs + artifact_blobs:
            src_lines = blob.splitlines()
            if all(ql in src_lines for ql in quote_lines):
                found_in.append(src)
                # Don't break — collect all sources for transparency.

        if not found_in:
            # Helpful diagnostics: show first 80 chars of the quote and what was searched
            preview = quote_lines[0][:80]
            errors.append(
                f"  assertion[{i}] {name!r}: evidence_quote not found anywhere\n"
                f"    quote preview: {preview!r}\n"
                f"    searched in: {len(command_blobs)} command excerpt(s), "
                f"{len(artifact_blobs)} artifact blob(s)"
            )

    # Per-environment sanity checks (the schema enforces these structurally;
    # we re-check for friendlier error messages).
    env = claim.get("target_environment")
    if env == "db-migration":
        log_artifacts = [a for a in artifacts if a.get("kind") == "log"]
        if not log_artifacts:
            errors.append("  db-migration: missing log artifact")
        for a in log_artifacts:
            ce = a.get("content_excerpt") or ""
            if len(ce) < 80:
                errors.append(
                    f"  db-migration: log artifact {a.get('path')!r} has "
                    f"content_excerpt of {len(ce)} chars (expected ≥ 80)"
                )
            # Same path-traversal guard as above.
            log_path = a.get("path", "")
            if log_path:
                try:
                    log_abs = ((claim_dir / log_path).resolve(strict=False) if not os.path.isabs(log_path)
                               else Path(log_path).resolve(strict=False))
                    if not is_safe_path(log_abs, claim_dir, cwd):
                        errors.append(
                            f"  db-migration: log artifact path={log_path!r} resolves to "
                            f"{log_abs!s} which is outside the project tree; refusing to read"
                        )
                        continue
                    on_disk = load_text(log_abs)
                except (OSError, RuntimeError) as e:
                    errors.append(f"  db-migration: log artifact path={log_path!r}: cannot resolve ({e})")
                    continue
            else:
                on_disk = ""
            if not on_disk.strip():
                errors.append(
                    f"  db-migration: log artifact {a.get('path')!r} is empty or unreadable"
                )

    return errors


def main(argv: list[str]) -> int:
    if not argv:
        print("usage: validate.py <claim.json> [<claim.json> ...]", file=sys.stderr)
        return 2

    total_errors = 0
    for arg in argv:
        claim_path = Path(arg)
        if not claim_path.is_file():
            print(f"❌ {claim_path}: file not found", file=sys.stderr)
            total_errors += 1
            continue
        claim_dir = claim_path.parent
        errors = check_claim(claim_path, claim_dir)
        if errors:
            print(f"❌ {claim_path}:")
            for e in errors:
                print(e)
            total_errors += 1
        else:
            print(f"✅ {claim_path}")

    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
