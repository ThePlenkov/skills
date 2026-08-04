#!/usr/bin/env bun
/**
 * OS-independent PR state dump for /act.
 *
 * Usage: pr-state.ts [OWNER REPO PR_NUMBER | PR_NUMBER]
 * Output: key=value lines followed by an OPEN_THREADS_TABLE TSV.
 */
import {
  detectProvider,
  execJson,
  execText,
  ghAuthOk,
  graphqlGh,
  paginatedGithubAnnotations,
  paginatedGithubCheckRuns,
  parseArgs,
  requireBin,
  resolveGitHubNumber,
  resolveGitHubOwnerRepo,
  type Provider,
} from "./lib/platform.ts";

const AI_REVIEWER_RE = /cubic|code\s*rabbit|amazon\s*q|qodo|chatgpt\s*codex|gemini|kilo/i;

export interface ThreadNode {
  id: string;
  isResolved: boolean;
  isOutdated?: boolean;
  path?: string;
  comments: {
    nodes: Array<{
      author?: { login?: string };
      path?: string;
      line?: number | null;
      body?: string;
    }>;
  };
}

interface PrStateJson {
  data: {
    repository: {
      pullRequest: {
        headRefOid: string;
        headRefName: string;
        mergeable: string;
        mergeStateStatus: string;
        state: string;
        url: string;
        isDraft: boolean;
        reviewThreads: {
          pageInfo: { hasNextPage: boolean; endCursor?: string | null };
          nodes: ThreadNode[];
        };
      };
    };
  };
}

function isSastToolName(name: string): boolean {
  const lower = name.toLowerCase();
  const sasts = [
    "sonarcloud",
    "sonarqube",
    "codacy",
    "codescene",
    "codeql",
    "semgrep",
    "opengrep",
    "trivy",
    "snyk",
    "skillspector",
    "gitguardian",
    "checkov",
    "kics",
    "tfsec",
    "gitleaks",
  ];
  return sasts.some((s) => lower.includes(s));
}

function normalizeArgs(argv: string[]): { owner: string; repo: string; number: string } {
  if (argv.length === 0) {
    const repo = resolveGitHubOwnerRepo();
    if (!repo) throw new Error("could not resolve GitHub owner/repo");
    const number = resolveGitHubNumber(repo.owner, repo.repo, undefined);
    return { ...repo, number };
  }
  if (argv.length === 1) {
    const repo = resolveGitHubOwnerRepo();
    if (!repo) throw new Error("could not resolve GitHub owner/repo");
    return { ...repo, number: argv[0] };
  }
  if (argv.length === 3) {
    return { owner: argv[0], repo: argv[1], number: argv[2] };
  }
  throw new Error("usage: pr-state.ts [OWNER REPO PR_NUMBER | PR_NUMBER]");
}

export function fetchPullRequest(owner: string, repo: string, number: string): PrStateJson["data"]["repository"]["pullRequest"] {
  const baseQuery = `query($o:String!,$r:String!,$pr:Int!,$n:Int!) {
  repository(owner:$o, name:$r) {
    pullRequest(number:$pr) {
      headRefOid
      headRefName
      mergeable
      mergeStateStatus
      state
      url
      isDraft
      reviewThreads(first:$n`;

  let afterClause = "";
  let cursor: string | undefined;
  const allThreads: ThreadNode[] = [];

  while (true) {
    const after = cursor ? `, after: "${cursor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : "";
    const query = `${baseQuery}${after}) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          comments(first: 1) { nodes { author { login } path line body } }
        }
      }
    }
  }
}`;
    const res = graphqlGh(query, { o: owner, r: repo, pr: Number(number), n: 100 }) as PrStateJson;
    if ((res as { errors?: unknown }).errors) {
      throw new Error(JSON.stringify((res as { errors?: unknown }).errors));
    }
    const pr = (res as PrStateJson).data?.repository?.pullRequest;
    if (!pr) throw new Error(`pull request #${number} not found in ${owner}/${repo}`);
    allThreads.push(...(pr.reviewThreads.nodes || []));
    if (!pr.reviewThreads.pageInfo.hasNextPage) {
      return { ...pr, reviewThreads: { ...pr.reviewThreads, nodes: allThreads } };
    }
    cursor = pr.reviewThreads.pageInfo.endCursor || undefined;
    if (!cursor) throw new Error("GraphQL response missing endCursor despite hasNextPage=true");
  }
}

function fetchChecks(owner: string, repo: string, number: string): Array<{ name: string; state: string; bucket: string }> {
  try {
    return execJson<Array<{ name: string; state: string; bucket: string }>>("gh", [
      "pr", "checks", number,
      "--repo", `${owner}/${repo}`,
      "--json", "name,state,bucket",
    ]);
  } catch (err) {
    const msg = String(err);
    if (/no checks reported/i.test(msg)) return [];
    throw err;
  }
}

export function githubPrState(owner: string, repo: string, number: string): {
  headSha: string;
  headRef: string;
  url: string;
  mergeable: string;
  mergeState: string;
  isDraft: boolean;
  openThreads: number;
  threads: ThreadNode[];
  ciRequiredPending: number;
  sastFindingsPending: number;
  sastFindingsUnknown: number;
} {
  requireBin("gh");
  if (!ghAuthOk()) throw new Error("gh is not authenticated");

  const pr = fetchPullRequest(owner, repo, number);
  const headSha = pr.headRefOid;
  const headRef = pr.headRefName;
  const url = pr.url;

  let mergeable = (pr.mergeable || "UNKNOWN").toString().toLowerCase();
  if (mergeable === "mergeable") mergeable = "MERGEABLE";
  else if (mergeable === "conflicting") mergeable = "CONFLICTING";
  else mergeable = mergeable.toUpperCase();

  const mergeState = pr.mergeStateStatus || "UNKNOWN";

  const openThreads = (pr.reviewThreads.nodes || []).filter((t) => !t.isResolved).length;

  const checks = fetchChecks(owner, repo, number);
  const ciRequiredPending = checks.filter(
    (c) => c.bucket !== "pass" && c.state !== "SKIPPED" && c.state !== "NEUTRAL" && !AI_REVIEWER_RE.test(c.name),
  ).length;

  let sastFindingsPending = 0;
  let sastFindingsUnknown = 0;

  if (ciRequiredPending > 0) {
    const checkRuns = paginatedGithubCheckRuns(owner, repo, headSha);
    const idByName = new Map(checkRuns.map((r) => [r.name, r.id]));
    for (const check of checks) {
      if (check.bucket === "pass" || check.state === "SKIPPED" || check.state === "NEUTRAL") continue;
      if (!isSastToolName(check.name)) continue;
      const runId = idByName.get(check.name);
      if (!runId) continue;
      try {
        const annotations = paginatedGithubAnnotations(owner, repo, runId);
        sastFindingsPending += annotations.filter((a) => a.annotation_level === "failure").length;
      } catch {
        sastFindingsUnknown += 1;
      }
    }
  }

  return {
    headSha,
    headRef,
    url,
    mergeable,
    mergeState,
    isDraft: pr.isDraft,
    openThreads,
    threads: pr.reviewThreads.nodes,
    ciRequiredPending,
    sastFindingsPending,
    sastFindingsUnknown,
  };
}

function main(): void {
  const { owner, repo, number } = normalizeArgs(process.argv.slice(2));
  const state = githubPrState(owner, repo, number);

  console.log(`HEAD_SHA=${state.headSha}`);
  console.log(`HEAD_REF=${state.headRef}`);
  console.log(`URL=${state.url}`);
  console.log(`MERGEABLE=${state.mergeable}`);
  console.log(`MERGE_STATE=${state.mergeState}`);
  console.log(`OPEN_THREADS=${state.openThreads}`);
  console.log(`CI_REQUIRED_PENDING=${state.ciRequiredPending}`);
  console.log(`SAST_FINDINGS_PENDING=${state.sastFindingsPending}`);
  console.log(`SAST_FINDINGS_UNKNOWN=${state.sastFindingsUnknown}`);
  console.log();
  console.log("OPEN_THREADS_TABLE:");
  for (const t of state.threads) {
    if (t.isResolved) continue;
    const c = t.comments.nodes[0] || {};
    const author = c.author?.login || "-";
    const path = c.path || "-";
    const line = c.line == null ? "-" : String(c.line);
    const body = (c.body || "").replace(/[\n\t]/g, " ").slice(0, 120);
    console.log(`${t.id}\t${author}\t${path}:${line}\t${body}`);
  }
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main();
}
