#!/usr/bin/env bun
/**
 * Shared runtime helpers for /act scripts.
 *
 * Design goals:
 * - No POSIX shell process substitution (<(...)) so the scripts run on Windows.
 * - No jq dependency; parse JSON in-process.
 * - Works with both `bun` and `node --import tsx`.
 */
import { spawnSync } from "node:child_process";

export type Provider = "github" | "gitlab";

export interface Target {
  provider: Provider;
  owner?: string;
  repo?: string;
  projectPath?: string;
  number: string;
}

export interface RunOptions {
  input?: string;
  ignoreExitCode?: boolean;
}

function toText(buf: Buffer | null): string {
  return buf ? buf.toString("utf8") : "";
}

export function execText(command: string, args: string[], opts: RunOptions = {}): string {
  const result = spawnSync(command, args, {
    stdio: [opts.input ? "pipe" : "inherit", "pipe", "pipe"],
    input: opts.input,
    encoding: "utf8",
  });
  if (!opts.ignoreExitCode && result.status !== 0) {
    const err = toText(result.stderr as unknown as Buffer) || toText(result.stdout as unknown as Buffer) || `${command} failed`;
    throw new Error(err.trim());
  }
  return toText(result.stdout as unknown as Buffer);
}

export function execJson<T = unknown>(command: string, args: string[], opts: RunOptions = {}): T {
  const text = execText(command, args, opts);
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`Failed to parse JSON from ${command}: ${(e as Error).message}\n${text.slice(0, 500)}`);
  }
}

export function requireBin(name: string): void {
  const result = spawnSync(process.platform === "win32" ? "where" : "which", [name], { stdio: "pipe" });
  if (result.status !== 0) {
    throw new Error(`required command not found: ${name}`);
  }
}

export function ghAuthOk(): boolean {
  const result = spawnSync("gh", ["auth", "status"], { stdio: "pipe" });
  return result.status === 0;
}

export function detectProvider(): Provider {
  const env = process.env.ACT_PROVIDER;
  if (env === "github" || env === "gitlab") return env;

  const remoteUrl = gitRemoteUrl("origin");
  if (remoteUrl) {
    if (remoteUrl.includes("github.com") || remoteUrl.startsWith("github:")) return "github";
    if (remoteUrl.includes("gitlab.com")) return "gitlab";
    if (/^https?:\/\/[^/]+\//.test(remoteUrl) || /^git@[^:]+:/.test(remoteUrl)) return "gitlab";
  }
  return "github";
}

export function gitRemoteUrl(name: string): string | undefined {
  const result = spawnSync("git", ["remote", "get-url", name], { stdio: "pipe" });
  if (result.status !== 0) return undefined;
  return toText(result.stdout as unknown as Buffer).trim();
}

export function gitCurrentBranch(): string | undefined {
  const result = spawnSync("git", ["branch", "--show-current"], { stdio: "pipe" });
  if (result.status !== 0) return undefined;
  return toText(result.stdout as unknown as Buffer).trim() || undefined;
}

export interface ParsedArgs {
  projectPath?: string;
  number?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const [arg1, arg2] = argv;
  if (!arg1) return {};
  if (arg2) {
    return { projectPath: arg1, number: arg2 };
  }
  if (/^[0-9]+$/.test(arg1)) {
    return { number: arg1 };
  }
  return { projectPath: arg1 };
}

function parseGitHubRemote(url: string): { owner: string; repo: string } | undefined {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (m) return { owner: m[1], repo: m[2] };
  return undefined;
}

function parseGitLabRemote(url: string): { projectPath: string } | undefined {
  const m = url.match(/^https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
  if (m) return { projectPath: m[1] };
  const sm = url.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
  if (sm) return { projectPath: sm[1] };
  return undefined;
}

export function resolveGitHubOwnerRepo(projectPath?: string): { owner: string; repo: string } | undefined {
  if (projectPath) {
    const parts = projectPath.split("/");
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
  }
  if (ghAuthOk()) {
    try {
      const json = execJson<{ owner?: { login?: string }; name?: string }>("gh", ["repo", "view", "--json", "owner,name"]);
      if (json.owner?.login && json.name) return { owner: json.owner.login, repo: json.name };
    } catch {
      // fall through
    }
  }
  const remote = gitRemoteUrl("origin");
  if (remote) return parseGitHubRemote(remote);
  return undefined;
}

export function resolveGitLabProjectPath(projectPath?: string): string | undefined {
  if (projectPath) return projectPath;
  const remote = gitRemoteUrl("origin");
  if (remote) return parseGitLabRemote(remote)?.projectPath;
  return undefined;
}

export function resolveGitHubNumber(owner: string, repo: string, number?: string): string {
  if (number) return number;
  const branch = gitCurrentBranch();
  const candidates = branch && branch !== "main" && branch !== "master"
    ? execJson<Array<{ number: number }>>("gh", ["pr", "list", "--head", branch, "--state", "open", "--json", "number", "--limit", "1"], { ignoreExitCode: true })
    : [];
  const list = Array.isArray(candidates) && candidates.length > 0
    ? candidates
    : execJson<Array<{ number: number }>>("gh", ["pr", "list", "--state", "open", "--json", "number", "--limit", "1"], { ignoreExitCode: true });
  if (!Array.isArray(list) || list.length === 0 || list[0]?.number == null) {
    throw new Error("could not resolve PR number");
  }
  return String(list[0].number);
}

export function resolveGitLabNumber(projectPath: string, number?: string): string {
  if (number) return number;
  const branch = gitCurrentBranch();
  if (!branch) throw new Error("cannot auto-detect GitLab MR number: not on a git branch");
  const token = process.env.GITLAB_TOKEN || process.env.GLAB_TOKEN;
  if (!token) throw new Error("GitLab MR number omitted and no token to auto-detect (set GITLAB_TOKEN or GLAB_TOKEN, or pass NUMBER)");
  const host = gitlabHost();
  const encodedPath = encodeURIComponent(projectPath);
  const encodedBranch = encodeURIComponent(branch);
  const url = `https://${host}/api/v4/projects/${encodedPath}/merge_requests?source_branch=${encodedBranch}&state=opened&per_page=1`;
  const result = execJson<Array<{ iid?: number }>>("curl", ["-fsSL", "-H", `PRIVATE-TOKEN: ${token}`, url]);
  if (!Array.isArray(result) || result.length === 0 || result[0]?.iid == null) {
    throw new Error(`could not find open GitLab MR for branch '${branch}' in ${projectPath}; pass the MR number`);
  }
  return String(result[0].iid);
}

export function gitlabHost(): string {
  return process.env.GITLAB_HOST || process.env.GL_HOST || "gitlab.com";
}

export function gitlabToken(): string | undefined {
  return process.env.GITLAB_TOKEN || process.env.GLAB_TOKEN;
}

export function resolveTarget(provider: Provider, parsed: ParsedArgs): { owner?: string; repo?: string; projectPath?: string; number: string } {
  if (provider === "github") {
    const repo = resolveGitHubOwnerRepo(parsed.projectPath);
    if (!repo) throw new Error("could not resolve GitHub owner/repo");
    const number = resolveGitHubNumber(repo.owner, repo.repo, parsed.number);
    return { provider, ...repo, number };
  }

  const projectPath = resolveGitLabProjectPath(parsed.projectPath);
  if (!projectPath) throw new Error("could not resolve GitLab project path");
  const number = resolveGitLabNumber(projectPath, parsed.number);
  return { provider, projectPath, number };
}

export function graphqlGh(query: string, variables: Record<string, unknown>): unknown {
  requireBin("gh");
  if (!ghAuthOk()) throw new Error("gh is not authenticated");
  const args = ["api", "graphql"];
  for (const [k, v] of Object.entries(variables)) {
    const flag = typeof v === "boolean" || typeof v === "number" || v === null ? "-F" : "-f";
    args.push(flag, `${k.replace(/^\$/, "")}=${v}`);
  }
  args.push("-f", `query=${query}`);
  return execJson<unknown>("gh", args);
}

export function graphqlGitLab(query: string, variables: Record<string, unknown>): unknown {
  const token = gitlabToken();
  if (!token) throw new Error("GitLab token not found (set GITLAB_TOKEN or GLAB_TOKEN)");
  const host = gitlabHost();
  const payload = JSON.stringify({ query, variables });
  // Token goes via curl --config - (stdin), not -H argv, to avoid exposure
  // in process listings (ps/top) and shell history. See CWE-214, issue #289.
  const config = `header = "PRIVATE-TOKEN: ${token}"\nheader = "Content-Type: application/json"\n`;
  const result = execText("curl", [
    "-fsSL",
    "--config", "-",
    "-X", "POST",
    "-d", payload,
    `https://${host}/api/graphql`,
  ], { input: config });
  return JSON.parse(result);
}

export interface GitLabRestOptions {
  method?: "GET" | "POST" | "PUT";
  query?: Record<string, string | number | boolean>;
  body?: Record<string, unknown>;
  ignoreExitCode?: boolean;
}

/**
 * Call a GitLab REST v4 endpoint under `/projects/:id/...`.
 *
 * `projectPath` is URL-encoded as the project `:id`. `path` is the suffix after
 * the project segment (e.g. `merge_requests/11/discussions`). The GitLab REST
 * API is stable for MR metadata, discussions, draft/ready transitions, replies,
 * and resolve — unlike the GraphQL schema, which churned (`DiffNote` position
 * shape, `mergeRequestSetDraft` access, REST-vs-GraphQL discussion ID mismatch).
 * See issue #284.
 */
export function gitlabRestProject<T = unknown>(projectPath: string, path: string, opts: GitLabRestOptions = {}): T {
  const token = gitlabToken();
  if (!token) throw new Error("GitLab token not found (set GITLAB_TOKEN or GLAB_TOKEN)");
  const host = gitlabHost();
  const method = opts.method ?? "GET";
  const encodedProject = encodeURIComponent(projectPath);
  let url = `https://${host}/api/v4/projects/${encodedProject}/${path}`;
  if (opts.query && Object.keys(opts.query).length > 0) {
    const qs = Object.entries(opts.query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    url += `?${qs}`;
  }
  // Token goes via curl --config - (stdin), not -H argv, to avoid exposure
  // in process listings (ps/top) and shell history. See CWE-214, issue #289.
  const configLines = [`header = "PRIVATE-TOKEN: ${token}"`];
  if (opts.body) {
    configLines.push(`header = "Content-Type: application/json"`);
  }
  const config = `${configLines.join("\n")}\n`;
  const args = ["-fsSL", "--config", "-", "-X", method];
  if (opts.body) {
    args.push("-d", JSON.stringify(opts.body));
  }
  args.push(url);
  const text = execText("curl", args, { input: config, ignoreExitCode: opts.ignoreExitCode });
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`Failed to parse GitLab REST JSON: ${(e as Error).message}\n${text.slice(0, 500)}`);
  }
}

/** Construct the human-facing web URL for a GitLab merge request. */
export function gitlabMrWebUrl(projectPath: string, number: string): string {
  const host = gitlabHost();
  return `https://${host}/${projectPath}/-/merge_requests/${number}`;
}

/** Construct the human-facing web URL for a GitHub pull request. */
export function githubPrWebUrl(owner: string, repo: string, number: string): string {
  return `https://github.com/${owner}/${repo}/pull/${number}`;
}

/**
 * Toggle the draft title marker on a GitLab MR title.
 *
 * The GitLab REST `PUT /merge_requests/:iid` endpoint has no `draft` boolean
 * param — draft state is encoded in the title prefix. GitLab recognises three
 * marker forms: `Draft:`, `WIP:` (legacy), and `[Draft]` / `(Draft)`. This
 * pure function computes the new title for a desired draft state.
 */
export function toggleDraftTitle(title: string, draft: boolean): string {
  // Strip any existing draft marker: Draft:/WIP: (with colon) or [Draft]/(Draft).
  // Do not trim unrelated leading whitespace — only the marker itself.
  const stripped = title.replace(
    /^(?:(?:Draft|WIP)\s*:\s*|(?:\[Draft\]|\(Draft\))\s*)/i,
    "",
  );
  return draft ? `Draft: ${stripped}` : stripped;
}

export function paginatedGithubCheckRuns(owner: string, repo: string, headSha: string): Array<{ id: number; name: string }> {
  const all: Array<{ id: number; name: string }> = [];
  let page = 1;
  while (true) {
    const res = execJson<{ check_runs: Array<{ id: number; name: string }> }>("gh", [
      "api",
      `repos/${owner}/${repo}/commits/${headSha}/check-runs?per_page=100&page=${page}`,
    ]);
    if (!res.check_runs?.length) break;
    all.push(...res.check_runs);
    if (res.check_runs.length < 100) break;
    page += 1;
  }
  return all;
}

export function paginatedGithubAnnotations(owner: string, repo: string, runId: number): Array<{ annotation_level?: string }> {
  const all: Array<{ annotation_level?: string }> = [];
  let page = 1;
  while (true) {
    const res = execJson<Array<{ annotation_level?: string }>>("gh", [
      "api",
      `--paginate`,
      `repos/${owner}/${repo}/check-runs/${runId}/annotations?per_page=100&page=${page}`,
    ]);
    if (!Array.isArray(res) || res.length === 0) break;
    all.push(...res);
    if (res.length < 100) break;
    page += 1;
  }
  return all;
}
