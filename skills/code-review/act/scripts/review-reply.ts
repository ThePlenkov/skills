#!/usr/bin/env bun
/**
 * Batch reply to review threads (GitHub PRs) or discussions (GitLab MRs).
 *
 * Usage: review-reply.ts [--file PATH] [--reaction NAME] [PROJECT] [NUMBER]
 *   PATH is a TSV file with one row per reply: <thread_or_discussion_id>\t<body>
 *   NAME is a ReactionContent for GitHub (EYES, THUMBS_UP) or an emoji name for GitLab (eyes, thumbsup).
 *   PROJECT is owner/repo for GitHub or group/project for GitLab.
 *   NUMBER is the PR/MR number (not used when --file is provided, kept for symmetry).
 */
import { readFileSync } from "node:fs";
import {
  detectProvider,
  graphqlGh,
  graphqlGitLab,
  parseArgs,
  resolveTarget,
} from "./lib/platform.ts";

interface ReplyRow {
  id: string;
  body: string;
}

function parseArgv(argv: string[]): { file: string; reaction: string; positional: string[] } {
  const positional: string[] = [];
  let file = "";
  let reaction = "";
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--file") {
      file = argv[i + 1] ?? "";
      if (!file) throw new Error("--file requires a value");
      i += 2;
    } else if (arg === "--reaction") {
      reaction = argv[i + 1] ?? "";
      if (!reaction) throw new Error("--reaction requires a value");
      i += 2;
    } else if (arg?.startsWith("--")) {
      throw new Error(`unknown flag: ${arg}`);
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  return { file, reaction, positional };
}

function decodeEscapes(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
}

function readReplies(path: string): ReplyRow[] {
  if (!path) throw new Error("usage: review-reply.ts --file PATH [--reaction NAME] [PROJECT] [NUMBER]");
  const text = readFileSync(path, "utf8");
  const rows: ReplyRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!line.trim()) continue;
    const tab = line.indexOf("\t");
    if (tab === -1) {
      console.warn(`warn: line ${idx + 1} has no tab separator, skipping`);
      continue;
    }
    const id = line.slice(0, tab).trim();
    const body = decodeEscapes(line.slice(tab + 1));
    if (!id) {
      console.warn(`warn: empty thread id on line ${idx + 1}`);
      continue;
    }
    rows.push({ id, body });
  }
  return rows;
}

function main(): void {
  const argv = process.argv.slice(2);
  const { file, reaction, positional } = parseArgv(argv);
  const replies = readReplies(file);
  if (replies.length === 0) {
    console.log(`no rows in ${file}`);
    return;
  }

  const provider = detectProvider();
  // Validate context; for GitLab we also need the MR node ID as noteableId.
  const target = resolveTarget(provider, parseArgs(positional));
  let gitlabNoteableId: string | undefined;
  if (provider === "gitlab") {
    if (!target.projectPath || !target.number) throw new Error("could not resolve GitLab MR");
    const mrQuery = `query($p:ID!,$i:String!){project(fullPath:$p){mergeRequest(iid:$i){id}}}`;
    const mrRes = graphqlGitLab(mrQuery, { p: target.projectPath, i: target.number }) as { errors?: unknown; data?: { project?: { mergeRequest?: { id?: string } } } };
    if (mrRes.errors) throw new Error(JSON.stringify(mrRes.errors));
    gitlabNoteableId = mrRes.data?.project?.mergeRequest?.id;
    if (!gitlabNoteableId) throw new Error("could not resolve GitLab MR node id");
  }

  let posted = 0;
  const failed: string[] = [];

  for (const { id, body } of replies) {
    try {
      if (provider === "github") {
        const replyQuery = `mutation($id:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id,body:$body}){comment{id}}}`;
        const replyRes = graphqlGh(replyQuery, { id, body }) as { errors?: unknown; data?: { addPullRequestReviewThreadReply?: { comment?: { id?: string } } } };
        if (replyRes.errors) throw new Error(JSON.stringify(replyRes.errors));
        const replyId = replyRes.data?.addPullRequestReviewThreadReply?.comment?.id;
        if (reaction && replyId) {
          try {
            const reactQuery = `mutation($id:ID!,$content:ReactionContent!){addReaction(input:{subjectId:$id,content:$content}){reaction{id}}}`;
            graphqlGh(reactQuery, { id: replyId, content: reaction });
          } catch {
            // Reaction failures are best-effort.
          }
        }
      } else {
        if (!gitlabNoteableId) throw new Error("GitLab MR node id not resolved");
        const replyQuery = `mutation($noteableId:NoteableID!,$discussionId:DiscussionID!,$body:String!){createNote(input:{noteableId:$noteableId,discussionId:$discussionId,body:$body}){note{id}}}`;
        const replyRes = graphqlGitLab(replyQuery, { noteableId: gitlabNoteableId, discussionId: id, body }) as { errors?: unknown; data?: { createNote?: { note?: { id?: string } } } };
        if (replyRes.errors) throw new Error(JSON.stringify(replyRes.errors));
        const replyId = replyRes.data?.createNote?.note?.id;
        if (reaction && replyId) {
          try {
            const reactQuery = `mutation($awardableId:AwardableID!,$name:String!){awardEmojiAdd(input:{awardableId:$awardableId,name:$name}){awardEmoji{name}}}`;
            graphqlGitLab(reactQuery, { awardableId: replyId, name: reaction });
          } catch {
            // Reaction failures are best-effort.
          }
        }
      }
      posted += 1;
      console.log(`replied ${id}`);
    } catch (err) {
      console.error(`error: failed to reply to ${id}: ${err}`);
      failed.push(id);
    }
  }

  if (failed.length > 0) {
    console.error(`posted=${posted} requested=${replies.length} failed=${failed.length}`);
    console.error(`failed_ids=${failed.join(" ")}`);
    process.exit(1);
  }

  console.log(`posted=${posted} requested=${replies.length}`);
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main();
}
