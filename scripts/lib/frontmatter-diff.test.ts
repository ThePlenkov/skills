import { describe, expect, test } from "bun:test";
import {
  baselinePathForStatus,
  bodyAfterFrontmatter,
  frontmatterEndLine,
  isFrontmatterOnlyChange,
} from "./frontmatter-diff.ts";

const OLD = `---
name: demo
source: ThePlenkov/skills
---

# Demo

\`\`\`bash
grep foo bar && echo hi
\`\`\`
`;

// Same body, only the frontmatter source: line changed.
const NEW_META_ONLY = OLD.replace("ThePlenkov/skills", "theplenkov-ai/skills");

// Body changed (a line removed) in addition to the frontmatter bump.
const NEW_BODY_CHANGED = NEW_META_ONLY.replace("grep foo bar && echo hi\n", "");

describe("frontmatterEndLine", () => {
  test("finds the closing --- of leading frontmatter", () => {
    expect(frontmatterEndLine(OLD)).toBe(4);
  });

  test("returns 0 when there is no frontmatter", () => {
    expect(frontmatterEndLine("# Just a heading\nbody\n")).toBe(0);
  });
});

describe("bodyAfterFrontmatter", () => {
  test("returns content after the closing delimiter", () => {
    expect(bodyAfterFrontmatter(OLD).startsWith("\n# Demo")).toBe(true);
    expect(bodyAfterFrontmatter(OLD).includes("name: demo")).toBe(false);
  });

  test("returns the whole text when there is no frontmatter", () => {
    expect(bodyAfterFrontmatter("plain body\n")).toBe("plain body\n");
  });
});

describe("isFrontmatterOnlyChange", () => {
  test("true when only a frontmatter line changed", () => {
    expect(isFrontmatterOnlyChange(OLD, NEW_META_ONLY)).toBe(true);
  });

  test("false when a body line changed", () => {
    expect(isFrontmatterOnlyChange(OLD, NEW_BODY_CHANGED)).toBe(false);
  });

  test("false when a body line was deleted even if frontmatter also changed", () => {
    expect(isFrontmatterOnlyChange(NEW_META_ONLY, NEW_BODY_CHANGED)).toBe(false);
  });

  test("true when the frontmatter closing delimiter itself is unchanged body-wise", () => {
    const a = "---\nx: 1\n---\nbody\n";
    const b = "---\nx: 2\ny: 3\n---\nbody\n";
    expect(isFrontmatterOnlyChange(a, b)).toBe(true);
  });

  test("ignores line-ending differences in the body", () => {
    const lf = "---\nx: 1\n---\n# H\ntext\n";
    const crlf = "---\nx: 2\n---\r\n# H\r\ntext\r\n";
    expect(isFrontmatterOnlyChange(lf, crlf)).toBe(true);
  });
});

describe("baselinePathForStatus", () => {
  const file = "skills/a/b/SKILL.md";

  test("modified files use themselves as baseline", () => {
    expect(baselinePathForStatus("M", file)).toBe(file);
    expect(baselinePathForStatus("T", file)).toBe(file);
  });

  test("added and copied files have no baseline", () => {
    expect(baselinePathForStatus("A", file)).toBeUndefined();
    expect(baselinePathForStatus("C100", file, "skills/src/SKILL.md")).toBeUndefined();
  });

  test("in-tree renames use the pre-rename path as baseline", () => {
    expect(baselinePathForStatus("R100", file, "skills/old/SKILL.md")).toBe("skills/old/SKILL.md");
  });

  test("renames from outside skills/ have no in-tree baseline", () => {
    expect(baselinePathForStatus("R100", file, "docs/old.md")).toBeUndefined();
    expect(baselinePathForStatus("R100", file, undefined)).toBeUndefined();
  });
});
