#!/usr/bin/env bun
/**
 * Batch resolve review threads (GitHub PRs) or discussions (GitLab MRs).
 *
 * Usage: review-resolve.ts [--file PATH] [PROJECT] [NUMBER]
 *   PROJECT is owner/repo for GitHub or group/project for GitLab.
 *   NUMBER is the PR/MR number (not used when --file is provided, kept for symmetry).
 *   PATH is a plain text file with one thread/discussion global ID per line.
 */
import { readFileSync } from "node:fs";
import {
  detectProvider,
  gitlabRestProject,
  graphqlGh,
  parseArgs,
  resolveTarget,
} from "./lib/platform.ts";

function parseArgv(argv: string[]): { file: string; positional: string[] } {
  const positional: string[] = [];
  let file = "";
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--file") {
      file = argv[i + 1] ?? "";
      if (!file) throw new Error("--file requires a value");
      i += 2;
    } else if (arg?.startsWith("--")) {
      throw new Error(`unknown flag: ${arg}`);
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  return { file, positional };
}

function readIds(path: string): string[] {
  if (!path) throw new Error("usage: review-resolve.ts --file PATH [PROJECT] [NUMBER]");
  const text = readFileSync(path, "utf8");
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function main(): void {
  const argv = process.argv.slice(2);
  const { file, positional } = parseArgv(argv);
  const ids = readIds(file);
  if (ids.length === 0) {
    console.log(`no ids in ${file}`);
    return;
  }

  const provider = detectProvider();
  // Number is not used, but resolving validates environment and provider setup.
  const target = resolveTarget(provider, parseArgs(positional));

  let resolved = 0;
  for (const id of ids) {
    if (provider === "github") {
      const query = `mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}`;
      const res = graphqlGh(query, { id }) as { errors?: unknown };
      if (res.errors) {
        throw new Error(JSON.stringify(res.errors));
      }
    } else {
      if (!target.projectPath || !target.number) throw new Error("GitLab MR context not resolved");
      // REST: PUT /projects/:id/merge_requests/:iid/discussions/:discussion_id?resolved=true
      // `id` is the REST discussion ID emitted by review-state.ts (e.g. "6a9c1750..."),
      // which is exactly what this endpoint expects — no GraphQL global-ID conversion.
      gitlabRestProject(
        target.projectPath,
        `merge_requests/${target.number}/discussions/${id}`,
        { method: "PUT", query: { resolved: "true" } },
      );
    }
    resolved += 1;
    console.log(`resolved ${id}`);
  }

  console.log(`resolved_total=${resolved}`);
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main();
}
