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
  graphqlGitLab,
  parseArgs,
  resolveTarget,
} from "./lib/platform.ts";

interface GitLabNote {
  id?: string;
  author?: { username?: string };
  body?: string;
  position?: { filePath?: string; newLine?: number | null; oldLine?: number | null } | null;
}

interface GitLabDiscussion {
  id: string;
  resolvable: boolean;
  resolved: boolean;
  notes: { nodes: GitLabNote[] };
}

interface GitLabMrJson {
  data?: {
    project?: {
      mergeRequest?: {
        id?: string;
        iid?: string;
        title?: string;
        draft?: boolean;
        state?: string;
        sourceBranch?: string;
        diffHeadSha?: string;
        webUrl?: string;
        headPipeline?: { status?: string } | null;
        discussions?: {
          pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
          nodes?: GitLabDiscussion[];
        };
      };
    };
  };
}

function gitlabMrState(projectPath: string, number: string) {
  const query = `query($p:ID!,$i:String!,$first:Int!,$after:String=null){
  project(fullPath:$p){
    mergeRequest(iid:$i){
      id iid title draft state sourceBranch diffHeadSha webUrl
      headPipeline{status}
      discussions(first:$first, after:$after){
        pageInfo{hasNextPage endCursor}
        nodes{
          id resolvable resolved
          notes(first:1){
            nodes{
              id author{username} body
              ... on DiffNote { position { filePath newLine oldLine } }
            }
          }
        }
      }
    }
  }
}`;

  const allDiscussions: GitLabDiscussion[] = [];
  let cursor: string | undefined;
  let prevCursor: string | undefined;

  while (true) {
    const variables: Record<string, unknown> = {
      p: projectPath,
      i: number,
      first: 100,
      after: cursor ?? null,
    };

    const res = graphqlGitLab(query, variables) as GitLabMrJson;
    if ((res as { errors?: unknown }).errors) {
      throw new Error(JSON.stringify((res as { errors?: unknown }).errors));
    }

    const mr = res.data?.project?.mergeRequest;
    if (!mr) throw new Error(`merge request !${number} not found in ${projectPath}`);

    const nodes = mr.discussions?.nodes || [];
    allDiscussions.push(...nodes);

    const pageInfo = mr.discussions?.pageInfo;
    if (!pageInfo?.hasNextPage) {
      const openThreads = allDiscussions.filter((d) => d.resolvable && !d.resolved).length;
      const pipelineStatus = mr.headPipeline?.status || "";
      const ciRequiredPending = pipelineStatus && pipelineStatus !== "SUCCESS" && pipelineStatus !== "SKIPPED" ? 1 : 0;

      const threads = allDiscussions.filter((d) => d.resolvable && !d.resolved);
      const rows = threads.map((d) => {
        const note = d.notes.nodes[0] || {};
        const pos = note.position;
        const location = pos ? `${pos.filePath}:${pos.newLine ?? pos.oldLine ?? "-"}` : "-";
        const author = note.author?.username || "-";
        const body = (note.body || "").replace(/[\n\t]/g, " ").slice(0, 120);
        return `${d.id}\t${author}\t${location}\t${body}`;
      });

      return {
        headSha: mr.diffHeadSha || "",
        headRef: mr.sourceBranch || "",
        url: mr.webUrl || "",
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

    const nextCursor = pageInfo.endCursor || undefined;
    if (!nextCursor) throw new Error("GitLab discussions pagination hasNextPage=true but endCursor is empty");
    if (nextCursor === prevCursor) throw new Error("GitLab discussions pagination cursor did not advance");
    prevCursor = cursor;
    cursor = nextCursor;
  }
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
