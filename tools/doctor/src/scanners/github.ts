import * as fs from "node:fs";
import * as path from "node:path";
import { execCapture, isCommandAvailable } from "../utils.ts";
import type { FindingSummary, RunContext, ScannerConfig, ScannerDefinition, ScannerRunResult } from "../types.ts";

interface GitHubRepo {
  owner: string;
  repo: string;
  branch: string;
}

interface CheckResult {
  exitCode: number;
  summary: FindingSummaryLike;
  errorMessage?: string;
  skipped?: boolean;
  skipReason?: string;
  commandSummary?: string;
}

interface FindingSummaryLike {
  totalResults: number;
  byRule?: Record<string, number>;
  byLevel?: Record<string, number>;
  details?: string[];
}

class GitHubApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "GitHubApiError";
  }
}

export const githubGroupName = "github";

export const githubScannerNames = [
  "github-branch-ci",
  "github-code-quality",
  "github-code-scanning",
  "github-dependabot",
  "github-secret-scanning",
  "github-security-advisories",
  "github-branch-protection",
];

export function isGitHubUrl(input: string): boolean {
  return /github\.com[:\/][^\/]+\/[^\/\s]+/.test(input);
}

export function parseGitHubUrl(input: string): { owner: string; repo: string } | undefined {
  const match = input.match(/github\.com[:\/]([^\/]+)\/([^\/\s]+?)(?:\.git)?$/i);
  if (!match) return undefined;
  return { owner: match[1], repo: match[2] };
}

export function expandGroup(name: string): string[] | undefined {
  if (name === githubGroupName) return [...githubScannerNames];
  return undefined;
}

export async function detectGitHubRepo(repoDir: string, urlHint?: string): Promise<GitHubRepo | undefined> {
  const gitAvailable = isCommandAvailable("git");
  let remoteUrl = urlHint;
  if (gitAvailable) {
    const remote = await execCapture("git", ["remote", "get-url", "origin"], { cwd: repoDir }).catch(() => ({ code: 1, stdout: "", stderr: "" }));
    if (remote.code === 0 && remote.stdout.trim()) {
      remoteUrl = remote.stdout.trim();
    }
  }
  const parsed = remoteUrl ? parseGitHubUrl(remoteUrl) : undefined;
  if (!parsed) return undefined;
  let branch: string | undefined;
  if (gitAvailable) {
    const branchRes = await execCapture("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoDir }).catch(() => ({ code: 1, stdout: "", stderr: "" }));
    branch = branchRes.code === 0 ? branchRes.stdout.trim() : undefined;
  }
  if (!branch || branch === "HEAD") {
    branch = await getDefaultBranch(parsed.owner, parsed.repo);
  }
  if (!branch) branch = "main";
  return { owner: parsed.owner, repo: parsed.repo, branch };
}

async function getDefaultBranch(owner: string, repo: string): Promise<string | undefined> {
  try {
    const data = await ghApiPath(`repos/${owner}/${repo}`) as { default_branch?: string };
    return data.default_branch;
  } catch {
    return undefined;
  }
}

async function ghApiPath(path: string, { paginate = false } = {}): Promise<unknown> {
  if (!isCommandAvailable("gh")) {
    throw new GitHubApiError("gh CLI is not available; install it from https://cli.github.com", 0);
  }
  const args = ["api", path];
  if (paginate) args.push("--paginate");
  const { code, stdout, stderr } = await execCapture("gh", args);
  if (code !== 0) {
    const match = stderr.match(/HTTP (\d{3})/);
    const status = match ? Number(match[1]) : 500;
    throw new GitHubApiError(stderr.trim(), status);
  }
  return parseGhOutput(stdout);
}

async function ghApiList(owner: string, repo: string, endpoint: string, params?: Record<string, string>): Promise<unknown[]> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  const data = await ghApiPath(`repos/${owner}/${repo}/${endpoint}${query}`, { paginate: true });
  if (Array.isArray(data)) {
    if (data.length > 0 && Array.isArray(data[0])) {
      return (data as unknown[][]).flat();
    }
    return data;
  }
  throw new GitHubApiError(`Expected array from gh api --paginate, got ${typeof data}`, 500);
}

function parseGhOutput(stdout: string): unknown {
  stdout = stdout.trim();
  if (!stdout) return [];
  try {
    return JSON.parse(stdout);
  } catch {
    const lines = stdout.split("\n").filter(Boolean);
    return lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return line;
      }
    });
  }
}

async function runCheck(
  name: string,
  run: (repo: GitHubRepo, ctx: RunContext) => Promise<CheckResult>,
  ctx: RunContext,
): Promise<ScannerRunResult> {
  const start = Date.now();
  const repo = await detectGitHubRepo(ctx.repoDir, ctx.repoUrl);
  if (!repo) {
    return {
      name,
      backend: "github",
      exitCode: 1,
      durationMs: Date.now() - start,
      outputs: [],
      commandSummary: "git remote get-url origin",
      errorMessage: "Repository is not a GitHub repository or has no origin remote.",
    };
  }

  if (ctx.dryRun) {
    return {
      name,
      backend: "github",
      exitCode: 0,
      durationMs: Date.now() - start,
      outputs: [],
      commandSummary: `gh api repos/${repo.owner}/${repo.repo}/...`,
    };
  }

  let result: CheckResult;
  try {
    result = await run(repo, ctx);
  } catch (err) {
    const status = err instanceof GitHubApiError ? err.status : undefined;
    const message = err instanceof Error ? err.message : String(err);
    if (status === 404) {
      result = {
        exitCode: 0,
        summary: {
          totalResults: 0,
          byLevel: {},
          byRule: {},
          details: ["Endpoint returned HTTP 404 — the feature may not be enabled for this repository."],
        },
        commandSummary: `gh api repos/${repo.owner}/${repo.repo}/...`,
      };
    } else {
      result = {
        exitCode: 1,
        summary: { totalResults: 0, byLevel: {}, byRule: {} },
        errorMessage: message,
        commandSummary: `gh api repos/${repo.owner}/${repo.repo}/...`,
      };
    }
  }

  const durationMs = Date.now() - start;
  const jsonPath = path.join(ctx.outputDir, `${name}.json`);
  const summary: FindingSummary = {
    scanner: name,
    file: jsonPath,
    totalResults: result.summary.totalResults,
    byRule: result.summary.byRule ?? {},
    byLevel: result.summary.byLevel ?? {},
    details: result.summary.details,
  };

  if (!ctx.dryRun) {
    fs.mkdirSync(ctx.outputDir, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  }

  return {
    name,
    backend: "github",
    exitCode: result.exitCode,
    durationMs,
    outputs: ctx.dryRun ? [] : [jsonPath],
    commandSummary: result.commandSummary ?? `gh api repos/${repo.owner}/${repo.repo}/...`,
    errorMessage: result.errorMessage,
    skipped: result.skipped,
    skipReason: result.skipReason,
  };
}

const branchCi: ScannerDefinition = {
  name: "github-branch-ci",
  async runLocal(_config: ScannerConfig, ctx: RunContext) {
    return runCheck("github-branch-ci", async (repo) => {
      const endpoint = `commits/${encodeURIComponent(repo.branch)}/check-runs`;
      const data = (await ghApiPath(`repos/${repo.owner}/${repo.repo}/${endpoint}?filter=latest&per_page=100`, { paginate: true })) as
        | { check_runs?: unknown[] }
        | Array<{ check_runs?: unknown[] }>;
      const pages = Array.isArray(data) ? data : [data];
      const runs = pages.flatMap((page) => (Array.isArray(page.check_runs) ? page.check_runs : []));
      const byLevel: Record<string, number> = {};
      const byRule: Record<string, number> = {};
      const details: string[] = [];
      let failed = false;

      for (const item of runs) {
        const run = item as { name?: string; status?: string; conclusion?: string | null };
        const name = run.name ?? "unknown";
        const status = run.status ?? "unknown";
        const conclusion = run.conclusion ?? "pending";
        byRule[name] = (byRule[name] ?? 0) + 1;

        if (status !== "completed") {
          byLevel["pending"] = (byLevel["pending"] ?? 0) + 1;
          failed = true;
          details.push(`${name}: pending (${status})`);
        } else if (conclusion === "success" || conclusion === "skipped" || conclusion === "neutral") {
          byLevel[conclusion] = (byLevel[conclusion] ?? 0) + 1;
        } else {
          byLevel[conclusion] = (byLevel[conclusion] ?? 0) + 1;
          failed = true;
          details.push(`${name}: ${conclusion}`);
        }
      }

      if (runs.length === 0) {
        const emptyByLevel: Record<string, number> = {};
        emptyByLevel["no check runs"] = 1;
        return {
          exitCode: 0,
          summary: {
            totalResults: 0,
            byLevel: emptyByLevel,
            byRule: {},
            details: ["No check runs found for this branch."],
          },
          commandSummary: `gh api repos/${repo.owner}/${repo.repo}/${endpoint}`,
        };
      }

      return {
        exitCode: failed ? 1 : 0,
        summary: { totalResults: runs.length, byLevel, byRule, details },
        commandSummary: `gh api repos/${repo.owner}/${repo.repo}/${endpoint}`,
      };
    }, ctx);
  },
};

const codeQuality: ScannerDefinition = {
  name: "github-code-quality",
  async runLocal(_config: ScannerConfig, ctx: RunContext) {
    return runCheck("github-code-quality", async (repo) => {
      if (repo.branch !== "main" && repo.branch !== "master") {
        const empty: Record<string, number> = {};
        return {
          exitCode: 0,
          skipped: true,
          skipReason: `current branch is ${repo.branch}; code quality is only checked on main/master`,
          summary: { totalResults: 0, byLevel: empty, byRule: empty },
          commandSummary: "skipped (not on main/master)",
        };
      }

      const findings = (await ghApiList(repo.owner, repo.repo, "code-quality/findings", {
        per_page: "100",
      })) as Array<{
        rule?: { id?: string; severity?: string; title?: string };
        location?: { path?: string; start_line?: number };
      }>;
      const byLevel: Record<string, number> = {};
      const byRule: Record<string, number> = {};
      const details: string[] = [];

      for (const finding of findings) {
        const ruleId = finding.rule?.id ?? "unknown";
        const severity = finding.rule?.severity ?? "note";
        byRule[ruleId] = (byRule[ruleId] ?? 0) + 1;
        byLevel[severity] = (byLevel[severity] ?? 0) + 1;
        if (details.length < 20) {
          const location = finding.location?.path ?? "unknown";
          const line = finding.location?.start_line ? `:${finding.location.start_line}` : "";
          details.push(`${ruleId} (${severity}) — ${location}${line}`);
        }
      }

      return {
        exitCode: 0,
        summary: { totalResults: findings.length, byLevel, byRule, details },
        commandSummary: `gh api repos/${repo.owner}/${repo.repo}/code-quality/findings`,
      };
    }, ctx);
  },
};

const codeScanning: ScannerDefinition = {
  name: "github-code-scanning",
  async runLocal(_config: ScannerConfig, ctx: RunContext) {
    return runCheck("github-code-scanning", async (repo) => {
      const alerts = (await ghApiList(repo.owner, repo.repo, "code-scanning/alerts", {
        state: "open",
        per_page: "100",
      })) as Array<{
        rule?: { id?: string; severity?: string };
        tool?: { name?: string };
        most_recent_instance?: { location?: { path?: string; start_line?: number } };
      }>;
      const byLevel: Record<string, number> = {};
      const byRule: Record<string, number> = {};
      const details: string[] = [];

      for (const alert of alerts) {
        const ruleId = alert.rule?.id ?? "unknown";
        const severity = alert.rule?.severity ?? "warning";
        byRule[ruleId] = (byRule[ruleId] ?? 0) + 1;
        byLevel[severity] = (byLevel[severity] ?? 0) + 1;
        if (details.length < 20) {
          const location = alert.most_recent_instance?.location?.path ?? "unknown";
          const line = alert.most_recent_instance?.location?.start_line ? `:${alert.most_recent_instance.location.start_line}` : "";
          details.push(`${ruleId} (${severity}) — ${location}${line}`);
        }
      }

      return {
        exitCode: 0,
        summary: { totalResults: alerts.length, byLevel, byRule, details },
        commandSummary: `gh api repos/${repo.owner}/${repo.repo}/code-scanning/alerts`,
      };
    }, ctx);
  },
};

const dependabot: ScannerDefinition = {
  name: "github-dependabot",
  async runLocal(_config: ScannerConfig, ctx: RunContext) {
    return runCheck("github-dependabot", async (repo) => {
      const alerts = (await ghApiList(repo.owner, repo.repo, "dependabot/alerts", {
        state: "open",
        per_page: "100",
      })) as Array<{
        security_advisory?: { ghsa_id?: string; severity?: string; summary?: string };
        security_vulnerability?: { package?: { name?: string } };
      }>;
      const byLevel: Record<string, number> = {};
      const byRule: Record<string, number> = {};
      const details: string[] = [];

      for (const alert of alerts) {
        const ghsa = alert.security_advisory?.ghsa_id ?? "unknown";
        const severity = alert.security_advisory?.severity ?? "unknown";
        const packageName = alert.security_vulnerability?.package?.name ?? "unknown";
        byRule[packageName] = (byRule[packageName] ?? 0) + 1;
        byLevel[severity] = (byLevel[severity] ?? 0) + 1;
        if (details.length < 20) {
          details.push(`${ghsa} (${severity}) — ${packageName}`);
        }
      }

      return {
        exitCode: 0,
        summary: { totalResults: alerts.length, byLevel, byRule, details },
        commandSummary: `gh api repos/${repo.owner}/${repo.repo}/dependabot/alerts`,
      };
    }, ctx);
  },
};

const secretScanning: ScannerDefinition = {
  name: "github-secret-scanning",
  async runLocal(_config: ScannerConfig, ctx: RunContext) {
    return runCheck("github-secret-scanning", async (repo) => {
      const alerts = (await ghApiList(repo.owner, repo.repo, "secret-scanning/alerts", {
        state: "open",
        per_page: "100",
      })) as Array<{
        secret_type?: string;
        secret_type_display_name?: string;
        resolution?: string | null;
      }>;
      const byLevel: Record<string, number> = {};
      const byRule: Record<string, number> = {};
      const details: string[] = [];

      for (const alert of alerts) {
        const type = alert.secret_type_display_name ?? alert.secret_type ?? "unknown";
        const state = alert.resolution ? `resolved (${alert.resolution})` : "open";
        byRule[type] = (byRule[type] ?? 0) + 1;
        byLevel[state] = (byLevel[state] ?? 0) + 1;
        if (details.length < 20) {
          details.push(`${type}: ${state}`);
        }
      }

      return {
        exitCode: 0,
        summary: { totalResults: alerts.length, byLevel, byRule, details },
        commandSummary: `gh api repos/${repo.owner}/${repo.repo}/secret-scanning/alerts`,
      };
    }, ctx);
  },
};

const securityAdvisories: ScannerDefinition = {
  name: "github-security-advisories",
  async runLocal(_config: ScannerConfig, ctx: RunContext) {
    return runCheck("github-security-advisories", async (repo) => {
      const advisories = (await ghApiList(repo.owner, repo.repo, "security-advisories", {
        per_page: "100",
      })) as Array<{ ghsa_id?: string; severity?: string; summary?: string; state?: string }>;
      const byLevel: Record<string, number> = {};
      const byRule: Record<string, number> = {};
      const details: string[] = [];

      for (const advisory of advisories) {
        const ghsa = advisory.ghsa_id ?? "unknown";
        const severity = advisory.severity ?? "unknown";
        byRule[ghsa] = (byRule[ghsa] ?? 0) + 1;
        byLevel[severity] = (byLevel[severity] ?? 0) + 1;
        if (details.length < 20) {
          details.push(`${ghsa} (${severity}) — ${advisory.summary ?? ""}`);
        }
      }

      return {
        exitCode: 0,
        summary: { totalResults: advisories.length, byLevel, byRule, details },
        commandSummary: `gh api repos/${repo.owner}/${repo.repo}/security-advisories`,
      };
    }, ctx);
  },
};

const branchProtection: ScannerDefinition = {
  name: "github-branch-protection",
  async runLocal(_config: ScannerConfig, ctx: RunContext) {
    return runCheck("github-branch-protection", async (repo) => {
      const endpoint = `branches/${encodeURIComponent(repo.branch)}/protection`;
      const commandSummary = `gh api repos/${repo.owner}/${repo.repo}/${endpoint}`;
      let protection: {
        required_status_checks?: unknown;
        required_pull_request_reviews?: unknown;
        enforce_admins?: { enabled?: boolean };
        restrictions?: unknown;
      };
      try {
        protection = (await ghApiPath(`repos/${repo.owner}/${repo.repo}/${endpoint}`)) as typeof protection;
      } catch (err) {
        if (err instanceof GitHubApiError && err.status === 404) {
          const notProtected: Record<string, number> = {};
          notProtected["not protected"] = 1;
          return {
            exitCode: 1,
            summary: {
              totalResults: 0,
              byLevel: notProtected,
              byRule: {},
              details: [`Branch ${repo.branch} is not protected.`],
            },
            errorMessage: `Branch ${repo.branch} is not protected`,
            commandSummary,
          };
        }
        throw err;
      }

      const details: string[] = [];
      if (protection.required_status_checks) details.push("required status checks");
      if (protection.required_pull_request_reviews) details.push("required PR reviews");
      if (protection.enforce_admins?.enabled) details.push("enforce admins");
      if (protection.restrictions) details.push("push restrictions");
      if (details.length === 0) details.push("protection enabled");

      const protectedLevel: Record<string, number> = { protected: 1 };
      return {
        exitCode: 0,
        summary: { totalResults: 1, byLevel: protectedLevel, byRule: {}, details },
        commandSummary,
      };
    }, ctx);
  },
};

export const githubScanners: ScannerDefinition[] = [
  branchCi,
  codeQuality,
  codeScanning,
  dependabot,
  secretScanning,
  securityAdvisories,
  branchProtection,
];
