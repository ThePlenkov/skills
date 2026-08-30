#!/usr/bin/env bun
/**
 * Unified PR/MR state dump for /act.
 *
 * Works with GitHub and GitLab using GraphQL. OS-independent: no shell process
 * substitution and no jq.
 *
 * Usage: review-state.ts [PROJECT] [NUMBER]
 *   PROJECT is owner/repo for GitHub or group/project for GitLab.
 *   NUMBER is the PR/MR number. If omitted, the most recently active open
 *   review in the current repo is used.
 */
import { githubPrState } from "./pr-state.ts";
import {
  detectProvider,
  gitlabMrWebUrl,
  gitlabRestProject,
  parseArgs,
  resolveTarget,
} from "./lib/platform.ts";

interface GitLabNote {
  id?: number;
  author?: { username?: string };
  body?: string;
  // REST position uses new_path/old_path/new_line/old_line (not GraphQL filePath/newLine).
  position?: {
    new_path?: string | null;
    old_path?: string | null;
    new_line?: number | null;
    old_line?: number | null;
  } | null;
  system?: boolean;
  // In the REST discussions API, `resolved` lives on the note, not the discussion.
  resolved?: boolean;
}

interface GitLabDiscussion {
  id: string;
  notes: GitLabNote[];
}

interface GitLabMr {
  iid: number;
  title: string;
  draft: boolean;
  state: string;
  source_branch: string;
  sha?: string;
  web_url: string;
  head_pipeline?: { status?: string; detailed_status?: { state?: string } } | null;
}

function gitlabMrState(projectPath: string, number: string) {
  const mr = gitlabRestProject<GitLabMr>(
    projectPath,
    `merge_requests/${number}`,
  );
  if (mr.iid == null) throw new Error(`merge request !${number} not found in ${projectPath}`);

  const allDiscussions: GitLabDiscussion[] = [];
  let page = 1;
  while (true) {
    const batch = gitlabRestProject<GitLabDiscussion[]>(
      projectPath,
      `merge_requests/${number}/discussions`,
      { query: { per_page: 100, page } },
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    allDiscussions.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  // A discussion is "resolvable" if its first note is a diff note (has a position).
  const isResolvable = (d: GitLabDiscussion): boolean => {
    const note = d.notes?.[0];
    return !!note && !!note.position;
  };
  // In the REST discussions API, `resolved` is on the note, not the discussion object.
  const isResolved = (d: GitLabDiscussion): boolean => !!d.notes?.[0]?.resolved;

  const openThreads = allDiscussions.filter((d) => isResolvable(d) && !isResolved(d)).length;
  const pipelineStatus = mr.head_pipeline?.detailed_status?.state || mr.head_pipeline?.status || "";
  const ciRequiredPending = pipelineStatus && pipelineStatus !== "success" && pipelineStatus !== "skipped" ? 1 : 0;

  const threads = allDiscussions.filter((d) => isResolvable(d) && !isResolved(d));
  const rows = threads.map((d) => {
    const note = d.notes?.[0] || {};
    const pos = note.position;
    const file = pos?.new_path || pos?.old_path || "-";
    const line = pos?.new_line ?? pos?.old_line ?? "-";
    const location = `${file}:${line}`;
    const author = note.author?.username || "-";
    const body = (note.body || "").replace(/[\n\t]/g, " ").slice(0, 120);
    return `${d.id}\t${author}\t${location}\t${body}`;
  });

  return {
    headSha: mr.sha || "",
    headRef: mr.source_branch || "",
    url: mr.web_url || gitlabMrWebUrl(projectPath, number),
    isDraft: !!mr.draft,
    mrState: mr.state || "",
    openThreads,
    ciRequiredPending,
    sastFindingsPending: 0,
    sastFindingsUnknown: 1,
    pipelineStatus,
    threadsTable: rows,
  };
}

function main(): void {
  const provider = detectProvider();
  const argv = process.argv.slice(2);

  let target;
  if (argv.length === 3) {
    // owner repo number shorthand, common for GitHub.
    target = { provider: "github" as const, owner: argv[0], repo: argv[1], number: argv[2] };
  } else {
    const parsed = parseArgs(argv);
    target = resolveTarget(provider, parsed);
  }

  if (provider === "github") {
    if (!target.owner || !target.repo) throw new Error("could not resolve GitHub owner/repo");
    const state = githubPrState(target.owner, target.repo, target.number);

    console.log(`HEAD_SHA=${state.headSha}`);
    console.log(`HEAD_REF=${state.headRef}`);
    console.log(`URL=${state.url}`);
    console.log(`MERGEABLE=${state.mergeable}`);
    console.log(`MERGE_STATE=${state.mergeState}`);
    console.log(`OPEN_THREADS=${state.openThreads}`);
    console.log(`CI_REQUIRED_PENDING=${state.ciRequiredPending}`);
    console.log(`SAST_FINDINGS_PENDING=${state.sastFindingsPending}`);
    console.log(`SAST_FINDINGS_UNKNOWN=${state.sastFindingsUnknown}`);
    console.log(`DRAFT=${state.isDraft}`);
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
    return;
  }

  if (!target.projectPath) throw new Error("could not resolve GitLab project path");
  const state = gitlabMrState(target.projectPath, target.number);

  console.log(`HEAD_SHA=${state.headSha}`);
  console.log(`HEAD_REF=${state.headRef}`);
  console.log(`URL=${state.url}`);
  console.log(`DRAFT=${state.isDraft}`);
  console.log(`MR_STATE=${state.mrState}`);
  console.log(`OPEN_THREADS=${state.openThreads}`);
  console.log(`CI_REQUIRED_PENDING=${state.ciRequiredPending}`);
  console.log(`SAST_FINDINGS_PENDING=${state.sastFindingsPending}`);
  console.log(`SAST_FINDINGS_UNKNOWN=${state.sastFindingsUnknown}`);
  console.log(`PIPELINE_STATUS=${state.pipelineStatus}`);
  console.log();
  console.log("OPEN_THREADS_TABLE:");
  for (const row of state.threadsTable) {
    console.log(row);
  }
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main();
}
