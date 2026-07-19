import { describe, expect, test } from "bun:test";
import { toPosixPath } from "./posix-path.ts";

describe("toPosixPath", () => {
  test("converts Windows backslash drive paths to MSYS form", () => {
    expect(toPosixPath(String.raw`C:\Users\foo\bar.sh`)).toBe("/c/Users/foo/bar.sh");
  });

  test("converts forward-slash Windows drive paths to MSYS form", () => {
    expect(toPosixPath("C:/Users/foo")).toBe("/c/Users/foo");
  });

  test("lowercases the drive letter", () => {
    expect(toPosixPath(String.raw`D:\repo\scripts\install.sh`)).toBe(
      "/d/repo/scripts/install.sh",
    );
  });

  test("leaves POSIX paths untouched", () => {
    expect(toPosixPath("/usr/bin/bash")).toBe("/usr/bin/bash");
    expect(toPosixPath("/tmp/x")).toBe("/tmp/x");
  });

  test("passes through plain strings without drive prefix", () => {
    expect(toPosixPath("plain")).toBe("plain");
    expect(toPosixPath("./bin/skills.js")).toBe("./bin/skills.js");
  });
});
