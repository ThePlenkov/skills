import { describe, expect, test } from "bun:test";
import { findBash, isWorkingShell, resolveTrustedBash } from "./find-bash.ts";

describe("findBash on current platform", () => {
  // The CI matrix deliberately exercises platforms where bash 4+ may or
  // may not be present (a stock macOS GitHub runner ships Apple's bash
  // 3.2 and no Homebrew). The helper may legitimately return null in
  // that case; we only assert that any non-null result is an absolute
  // path, not that bash 4+ is always installable.
  test("non-null results are absolute paths on every platform", () => {
    const result = findBash();
    if (result === null) return;
    expect(/^[A-Za-z]:[\\/]|^\//.test(result)).toBe(true);
  });

  test("resolveTrustedBash rejects bare 'bash' / non-absolute results", () => {
    const result = resolveTrustedBash();
    if (result === null) return;
    expect(result).not.toBe("bash");
    expect(/^[A-Za-z]:[\\/]|^\//.test(result)).toBe(true);
  });
});

describe("isWorkingShell", () => {
  test("returns false for a clearly missing binary", () => {
    expect(isWorkingShell(`__definitely_missing_${process.pid}`)).toBe(false);
  });
});

