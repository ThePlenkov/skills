#!/usr/bin/env bun
/**
 * Toggle a PR (GitHub) or MR (GitLab) between draft and ready-for-review.
 *
 * Usage: set-review-state.ts --draft|--ready [PROJECT] [NUMBER]
 *   PROJECT is owner/repo for GitHub or group/project for GitLab.
 *   NUMBER is the PR/MR number. If omitted, the most recently active open
 *   review in the current repo is used.
 */
import {
  detectProvider,
  ghAuthOk,
  gitlabRestProject,
  graphqlGh,
  parseArgs,
  requireBin,
  resolveGitHubNumber,
  resolveGitHubOwnerRepo,
  resolveGitLabNumber,
  resolveGitLabProjectPath,
  toggleDraftTitle,
} from "./lib/platform.ts";

function parseArgv(argv: string[]): { mode: "draft" | "ready"; positional: string[] } {
  const positional: string[] = [];
  let mode: "draft" | "ready" | undefined;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--draft") {
      mode = "draft";
      i += 1;
    } else if (arg === "--ready") {
      mode = "ready";
      i += 1;
    } else if (arg?.startsWith("--")) {
      throw new Error(`unknown flag: ${arg}`);
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  if (!mode) {
    throw new Error("usage: set-review-state.ts --draft|--ready [PROJECT] [NUMBER]");
  }
  return { mode, positional };
}

function main(): void {
  const { mode, positional } = parseArgv(process.argv.slice(2));
  const provider = detectProvider();
  const parsed = parseArgs(positional);

  if (provider === "github") {
    requireBin("gh");
    if (!ghAuthOk()) throw new Error("gh is not authenticated");

    const repo = resolveGitHubOwnerRepo(parsed.projectPath);
    if (!repo) throw new Error("could not resolve GitHub owner/repo");
    const number = resolveGitHubNumber(repo.owner, repo.repo, parsed.number);

    const prQuery = `query($o:String!,$r:String!,$pr:Int!){repository(owner:$o,name:$r){pullRequest(number:$pr){id}}}`;
    const prRes = graphqlGh(prQuery, { o: repo.owner, r: repo.repo, pr: Number(number) }) as { errors?: unknown; data?: { repository?: { pullRequest?: { id?: string } } } };
    if (prRes.errors) throw new Error(JSON.stringify(prRes.errors));
    const prId = prRes.data?.repository?.pullRequest?.id;
    if (!prId) throw new Error("could not resolve PR node id");

    const query = mode === "draft"
      ? `mutation($id:ID!){convertPullRequestToDraft(input:{pullRequestId:$id}){pullRequest{id isDraft}}}`
      : `mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{id isDraft}}}`;
    const res = graphqlGh(query, { id: prId }) as { errors?: unknown; data?: { convertPullRequestToDraft?: { pullRequest?: { isDraft?: boolean } }; markPullRequestReadyForReview?: { pullRequest?: { isDraft?: boolean } } } };
    if (res.errors) throw new Error(JSON.stringify(res.errors));
    const isDraft = res.data?.convertPullRequestToDraft?.pullRequest?.isDraft ?? res.data?.markPullRequestReadyForReview?.pullRequest?.isDraft;
    console.log(`provider=github owner=${repo.owner} repo=${repo.repo} pr=${number} draft=${isDraft}`);
    return;
  }

  const projectPath = resolveGitLabProjectPath(parsed.projectPath);
  if (!projectPath) throw new Error("could not resolve GitLab project path");
  const number = resolveGitLabNumber(projectPath, parsed.number);

  const draftValue = mode === "draft";
  // GitLab REST has no `draft` boolean on PUT /merge_requests/:iid — draft state
  // is encoded in the title prefix. Fetch the title, toggle the prefix, PUT it back.
  const mr = gitlabRestProject<{ title: string; draft: boolean }>(
    projectPath,
    `merge_requests/${number}`,
  );
  const newTitle = toggleDraftTitle(mr.title, draftValue);
  const updated = gitlabRestProject<{ draft: boolean }>(
    projectPath,
    `merge_requests/${number}`,
    { method: "PUT", body: { title: newTitle } },
  );
  const isDraft = updated.draft ?? draftValue;
  console.log(`provider=gitlab project=${projectPath} mr=${number} draft=${isDraft}`);
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main();
}
