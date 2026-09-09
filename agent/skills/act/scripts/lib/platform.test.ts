import { describe, expect, test } from "bun:test";
import {
  githubPrWebUrl,
  gitlabMrWebUrl,
  redactSecrets,
  toggleDraftTitle,
  validateGitLabHost,
} from "./platform.ts";

/**
 * Tests for the provider-neutral helpers added for issue #284.
 *
 * These cover the pure logic that the GitLab REST migration relies on:
 *   - toggleDraftTitle: Draft:/WIP: prefix toggle (set-review-state.ts)
 *   - gitlabMrWebUrl / githubPrWebUrl: source review URL construction
 *     (submit-scores.ts, extract-findings.ts)
 *
 * Network-dependent REST calls (gitlabRestProject) are not unit-tested here;
 * they are thin curl wrappers exercised by the script-index integration paths.
 */

describe("toggleDraftTitle", () => {
  test("adds Draft: prefix when marking draft", () => {
    expect(toggleDraftTitle("Fix login bug", true)).toBe("Draft: Fix login bug");
  });

  test("strips Draft: prefix when marking ready", () => {
    expect(toggleDraftTitle("Draft: Fix login bug", false)).toBe("Fix login bug");
  });

  test("strips legacy WIP: prefix when marking ready", () => {
    expect(toggleDraftTitle("WIP: Fix login bug", false)).toBe("Fix login bug");
  });

  test("strips Draft: prefix with no trailing space", () => {
    expect(toggleDraftTitle("Draft:Fix login bug", false)).toBe("Fix login bug");
  });

  test("is idempotent: toggling draft twice restores original", () => {
    const original = "Refactor auth module";
    const once = toggleDraftTitle(original, true);
    const twice = toggleDraftTitle(once, false);
    expect(twice).toBe(original);
  });

  test("does not double-prefix when already Draft:", () => {
    expect(toggleDraftTitle("Draft: Fix login bug", true)).toBe("Draft: Fix login bug");
  });

  test("replaces legacy WIP: with Draft: when marking draft", () => {
    expect(toggleDraftTitle("WIP: Fix login bug", true)).toBe("Draft: Fix login bug");
  });

  test("ready on a non-draft title is a no-op", () => {
    expect(toggleDraftTitle("Fix login bug", false)).toBe("Fix login bug");
  });

  test("handles empty title", () => {
    expect(toggleDraftTitle("", true)).toBe("Draft: ");
    expect(toggleDraftTitle("", false)).toBe("");
  });

  test("strips [Draft] marker when marking ready", () => {
    expect(toggleDraftTitle("[Draft] Fix login bug", false)).toBe("Fix login bug");
  });

  test("strips (Draft) marker when marking ready", () => {
    expect(toggleDraftTitle("(Draft) Fix login bug", false)).toBe("Fix login bug");
  });

  test("replaces [Draft] with Draft: when marking draft", () => {
    expect(toggleDraftTitle("[Draft] Fix login bug", true)).toBe("Draft: Fix login bug");
  });

  test("replaces (Draft) with Draft: when marking draft", () => {
    expect(toggleDraftTitle("(Draft) Fix login bug", true)).toBe("Draft: Fix login bug");
  });

  test("does not trim unrelated leading whitespace when marking ready", () => {
    // A title with intentional leading whitespace (e.g. indentation) must be
    // preserved — only the draft marker itself is removed.
    expect(toggleDraftTitle("  Fix login bug", false)).toBe("  Fix login bug");
  });

  test("strips all separator whitespace after Draft: colon", () => {
    // The \s* after : consumes the separator whitespace — this is correct,
    // it's part of the marker, not the title content.
    expect(toggleDraftTitle("Draft:   Fix login bug", false)).toBe("Fix login bug");
  });
});

describe("githubPrWebUrl", () => {
  test("constructs canonical PR URL", () => {
    expect(githubPrWebUrl("ThePlenkov", "skills", "16")).toBe(
      "https://github.com/ThePlenkov/skills/pull/16",
    );
  });
});

describe("gitlabMrWebUrl", () => {
  test("constructs canonical MR URL with /-/merge_requests/", () => {
    expect(gitlabMrWebUrl("group/project", "131")).toBe(
      "https://gitlab.com/group/project/-/merge_requests/131",
    );
  });

  test("preserves subgroup paths", () => {
    expect(gitlabMrWebUrl("group/sub/team", "42")).toBe(
      "https://gitlab.com/group/sub/team/-/merge_requests/42",
    );
  });

  test("respects GITLAB_HOST override", () => {
    const prev = process.env.GITLAB_HOST;
    process.env.GITLAB_HOST = "gitlab.example.com";
    try {
      expect(gitlabMrWebUrl("group/project", "7")).toBe(
        "https://gitlab.example.com/group/project/-/merge_requests/7",
      );
    } finally {
      if (prev === undefined) delete process.env.GITLAB_HOST;
      else process.env.GITLAB_HOST = prev;
    }
  });
});

describe("validateGitLabHost", () => {
  test("accepts a bare hostname", () => {
    expect(validateGitLabHost("gitlab.com")).toBe("gitlab.com");
  });

  test("accepts a hostname with subdomain", () => {
    expect(validateGitLabHost("gitlab.example.com")).toBe("gitlab.example.com");
  });

  test("accepts a hostname with port", () => {
    expect(validateGitLabHost("gitlab.example.com:8080")).toBe("gitlab.example.com:8080");
  });

  test("rejects a URL with scheme", () => {
    expect(() => validateGitLabHost("https://evil.com")).toThrow();
  });

  test("rejects a URL with path", () => {
    expect(() => validateGitLabHost("evil.com/exfil")).toThrow();
  });

  test("rejects a URL with query string", () => {
    expect(() => validateGitLabHost("evil.com?token=steal")).toThrow();
  });

  test("rejects an empty string", () => {
    expect(() => validateGitLabHost("")).toThrow();
  });

  test("rejects a host with spaces", () => {
    expect(() => validateGitLabHost("evil .com")).toThrow();
  });

  test("rejects an IPv4 address", () => {
    expect(() => validateGitLabHost("127.0.0.1")).toThrow();
    expect(() => validateGitLabHost("10.0.0.1")).toThrow();
    expect(() => validateGitLabHost("192.168.1.1")).toThrow();
  });

  test("rejects localhost", () => {
    expect(() => validateGitLabHost("localhost")).toThrow();
  });

  test("error message does not interpolate the raw host value", () => {
    try {
      validateGitLabHost("evil.com?token=secret");
      throw new Error("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).not.toContain("evil.com?token=secret");
      expect(msg).not.toContain("secret");
    }
  });
});

describe("redactSecrets", () => {
  test("redacts PRIVATE-TOKEN header from curl config form", () => {
    const input = 'header = "PRIVATE-TOKEN: glpat-xxxxxxxxxxxxxxxxxxxx"';
    expect(redactSecrets(input)).toBe('header = "PRIVATE-TOKEN: [REDACTED]"');
  });

  test("redacts token= query parameter", () => {
    expect(redactSecrets("https://example.com/api?token=secret123")).toBe(
      "https://example.com/api?token=[REDACTED]",
    );
  });

  test("leaves non-token text unchanged", () => {
    expect(redactSecrets("merge_request 42 not found")).toBe("merge_request 42 not found");
  });

  test("redacts multiple occurrences", () => {
    const input = "PRIVATE-TOKEN: abc PRIVATE-TOKEN: def";
    expect(redactSecrets(input)).toBe("PRIVATE-TOKEN: [REDACTED] PRIVATE-TOKEN: [REDACTED]");
  });
});
