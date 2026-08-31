#!/usr/bin/env bun
/**
 * Mark open PR review threads as resolved (GitHub GraphQL only).
 *
 * Usage: resolve-open-threads.ts [--dry-run] [OWNER REPO PR_NUMBER | PR_NUMBER]
 *
 * Does NOT implement review feedback — run only after code fixes / in-thread
 * replies (/act P4).
 */
import { fetchPullRequest, type ThreadNode } from "./pr-state.ts";
import { ghAuthOk, graphqlGh, requireBin, resolveGitHubOwnerRepo } from "./lib/platform.ts";

function resolveArgs(argv: string[]): { dryRun: boolean; owner: string; repo: string; number: string } {
  let dryRun = false;
  let rest = argv;
  if (rest[0] === "--dry-run") {
    dryRun = true;
    rest = rest.slice(1);
  }

  let owner: string | undefined;
  let repo: string | undefined;
  let number: string | undefined;

  if (rest.length === 1) {
    const repoInfo = resolveGitHubOwnerRepo();
    if (!repoInfo) {
      throw new Error("usage: resolve-open-threads.ts [--dry-run] [OWNER REPO PR_NUMBER | PR_NUMBER]");
    }
    owner = repoInfo.owner;
    repo = repoInfo.repo;
    number = rest[0];
  } else if (rest.length === 3) {
    owner = rest[0];
    repo = rest[1];
    number = rest[2];
  } else {
    throw new Error("usage: resolve-open-threads.ts [--dry-run] [OWNER REPO PR_NUMBER | PR_NUMBER]");
  }

  return { dryRun, owner, repo, number };
}

function main(): void {
  const { dryRun, owner, repo, number } = resolveArgs(process.argv.slice(2));
  requireBin("gh");
  if (!ghAuthOk()) throw new Error("gh is not authenticated");

  const pr = fetchPullRequest(owner, repo, number);
  const open = (pr.reviewThreads.nodes || []).filter((t: ThreadNode) => !t.isResolved);

  console.log(`open_threads=${open.length}`);
  if (open.length === 0) {
    console.log("nothing to resolve");
    return;
  }

  for (const t of open) {
    console.log(`${t.id}\toutdated=${t.isOutdated ?? false}\t${t.path ?? "-"}`);
  }

  if (dryRun) {
    console.log(`dry-run: would resolve ${open.length} thread(s)`);
    return;
  }

  const mutation = `mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}`;
  let resolved = 0;
  for (const t of open) {
    const res = graphqlGh(mutation, { id: t.id }) as { errors?: unknown; data?: { resolveReviewThread?: { thread?: { isResolved?: boolean } } } };
    if (res.errors) {
      throw new Error(JSON.stringify(res.errors));
    }
    const ok = res.data?.resolveReviewThread?.thread?.isResolved ?? false;
    if (ok) {
      resolved += 1;
      console.log(`resolved ${t.id}`);
    } else {
      throw new Error(`failed to resolve ${t.id}: ${JSON.stringify(res)}`);
    }
  }

  console.log(`resolved_total=${resolved} open_remaining=${open.length - resolved}`);
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main();
}
