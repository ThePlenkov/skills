#!/usr/bin/env bun
/**
 * Harvest unresolved PR review threads into .agents/review-debt/harvests/*.jsonl.
 *
 * Triggered by review-debt-harvest.yml on merge (or workflow_dispatch).
 * Not part of /act — run only on merge or manual backfill.
 *
 * Usage:
 *   bun run act:debt:harvest-pr -- PR --merged-sha SHA --run-id RUN_ID
 *   bun run act:debt:harvest-pr -- 81 --dry-run
 *   bun .agents/skills/act/scripts/harvest-threads.ts OWNER REPO PR --merged-sha SHA
 */
import {
  buildSummary,
  classifyThread,
  loadConfig,
  readDebtRecords,
  writeHarvestFile,
  writeSummary,
  type DebtRecord,
} from './review-debt-lib.ts'
import { ensureGhAuth, fetchReviewThreads, gh } from './review-debt-gh.ts'
import { bodyPreview, deriveArea, fingerprint } from './review-debt-text.ts'

interface HarvestArgs {
  owner: string
  repo: string
  pr: number
  mergedSha: string
  runId: string
  dryRun: boolean
}

function readFlag(argv: string[], index: number): [string | null, number] {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    return [null, index]
  }
  return [value, index + 1]
}

interface HarvestParseState {
  positional: string[]
  mergedSha: string
  runId: string
  dryRun: boolean
}

const HARVEST_FLAG_HANDLERS: Record<
  string,
  (state: HarvestParseState, argv: string[], i: number) => number
> = {
  '--dry-run': (state) => {
    state.dryRun = true
    return 0
  },
  '--merged-sha': (state, argv, i) => {
    const [value, next] = readFlag(argv, i)
    state.mergedSha = value ?? ''
    return next - i
  },
  '--run-id': (state, argv, i) => {
    const [value, next] = readFlag(argv, i)
    if (value) {
      state.runId = value
    }
    return next - i
  },
}

function applyHarvestToken(
  state: HarvestParseState,
  arg: string,
  argv: string[],
  index: number
): number {
  const handler = HARVEST_FLAG_HANDLERS[arg]
  if (!handler) {
    state.positional.push(arg)
    return 0
  }
  return handler(state, argv, index)
}

function parseArgs(argv: string[]): HarvestArgs {
  const state: HarvestParseState = {
    positional: [],
    mergedSha: '',
    runId: 'local',
    dryRun: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    i += applyHarvestToken(state, argv[i]!, argv, i)
  }

  return finalizeHarvestArgs(state)
}

function missingHarvestPositionals(
  owner: string | undefined,
  repo: string | undefined,
  pr: number
): boolean {
  if (!owner) {
    return true
  }
  if (!repo) {
    return true
  }
  return !Number.isFinite(pr)
}

function finalizeHarvestArgs(opts: HarvestParseState): HarvestArgs {
  const [owner, repo, prRaw] = opts.positional
  const pr = Number(prRaw)
  if (missingHarvestPositionals(owner, repo, pr)) {
    console.error(
      'Usage: harvest-threads.ts OWNER REPO PR_NUMBER [--merged-sha SHA] [--run-id ID] [--dry-run]'
    )
    process.exit(2)
  }
  return {
    owner,
    repo,
    pr,
    mergedSha: opts.mergedSha,
    runId: opts.runId,
    dryRun: opts.dryRun,
  }
}

function fetchPrMeta(opts: HarvestArgs): {
  title: string
  url: string
  mergedAt: string
  mergeSha: string
} {
  const viewed = JSON.parse(
    gh([
      'pr',
      'view',
      String(opts.pr),
      '--repo',
      `${opts.owner}/${opts.repo}`,
      '--json',
      'title,url,mergedAt,mergeCommit,state',
    ])
  ) as {
    title: string
    url: string
    mergedAt: string | null
    mergeCommit?: { oid: string }
    state: string
  }

  if (viewed.state !== 'MERGED') {
    throw new Error(`PR #${opts.pr} is not merged (state=${viewed.state})`)
  }

  const mergeSha = opts.mergedSha || viewed.mergeCommit?.oid || ''
  return {
    title: viewed.title,
    url: viewed.url,
    mergedAt: viewed.mergedAt ?? new Date().toISOString(),
    mergeSha,
  }
}

function threadUrl(prUrl: string, threadId: string): string {
  return `${prUrl}#${threadId}`
}

function toDebtRecord(opts: {
  thread: Awaited<ReturnType<typeof fetchReviewThreads>>[number]
  meta: ReturnType<typeof fetchPrMeta>
  pr: number
  runId: string
  harvestedAt: string
  classification: ReturnType<typeof classifyThread>
}): DebtRecord {
  const comment = opts.thread.comments.nodes[0] ?? {}
  const author = comment.author?.login ?? 'unknown'
  const path = comment.path ?? ''
  const body = comment.body ?? ''

  return {
    thread_id: opts.thread.id,
    thread_url: threadUrl(opts.meta.url, opts.thread.id),
    status: 'open',
    priority: opts.classification.priority,
    needs: opts.classification.needs,
    source_pr: opts.pr,
    source_pr_url: opts.meta.url,
    source_pr_title: opts.meta.title,
    merged_at: opts.meta.mergedAt,
    merged_sha: opts.meta.mergeSha,
    path,
    line: comment.line ?? null,
    author,
    body,
    body_preview: bodyPreview(body),
    fingerprint: fingerprint({ body, path }),
    area: deriveArea(path),
    harvested_at: opts.harvestedAt,
    harvest_run_id: opts.runId,
    times_seen: 1,
    fix_pr: null,
    fixed_at: null,
    notes: null,
  }
}

export interface HarvestPrResult {
  pr: number
  incoming: DebtRecord[]
  skipped: number
  skippedOutdated: number
  skippedThreadAuthor: number
}

type SkipReason = 'outdated' | 'thread_author' | 'config'
type ThreadAction =
  | { kind: 'skip'; reason: SkipReason }
  | {
      kind: 'harvest'
      author: string
      classification: ReturnType<typeof classifyThread>
    }

function authorMatchesFilter(author: string, threadAuthor: string | null): boolean {
  const needle = threadAuthor?.toLowerCase()
  return !needle || author.toLowerCase().includes(needle)
}

function classifyThreadAction(opts: {
  thread: Awaited<ReturnType<typeof fetchReviewThreads>>[number]
  threadAuthor: string | null
  config: ReturnType<typeof loadConfig>
}): ThreadAction | null {
  if (opts.thread.isResolved || opts.thread.isOutdated) {
    return opts.thread.isOutdated ? { kind: 'skip', reason: 'outdated' } : null
  }
  const author = opts.thread.comments.nodes[0]?.author?.login ?? 'unknown'
  if (!authorMatchesFilter(author, opts.threadAuthor)) {
    return { kind: 'skip', reason: 'thread_author' }
  }
  const classification = classifyThread({ author, config: opts.config })
  if (!classification.harvest) {
    return { kind: 'skip', reason: 'config' }
  }
  return { kind: 'harvest', author, classification }
}

function recordSkip(counts: Omit<HarvestPrResult, 'pr' | 'incoming'>, reason: SkipReason): void {
  if (reason === 'outdated') {
    counts.skippedOutdated += 1
  } else if (reason === 'thread_author') {
    counts.skippedThreadAuthor += 1
  } else {
    counts.skipped += 1
  }
}

function collectHarvestRows(opts: {
  threads: Awaited<ReturnType<typeof fetchReviewThreads>>
  config: ReturnType<typeof loadConfig>
  meta: ReturnType<typeof fetchPrMeta>
  pr: number
  runId: string
  harvestedAt: string
  threadAuthor: string | null
}): Omit<HarvestPrResult, 'pr'> {
  const incoming: DebtRecord[] = []
  const counts = { skipped: 0, skippedOutdated: 0, skippedThreadAuthor: 0 }

  for (const thread of opts.threads) {
    const action = classifyThreadAction({
      thread,
      threadAuthor: opts.threadAuthor,
      config: opts.config,
    })
    if (!action) {
      continue
    }
    if (action.kind === 'skip') {
      recordSkip(counts, action.reason)
      continue
    }
    incoming.push(
      toDebtRecord({
        thread,
        meta: opts.meta,
        pr: opts.pr,
        runId: opts.runId,
        harvestedAt: opts.harvestedAt,
        classification: action.classification,
      })
    )
  }

  return { incoming, ...counts }
}

export async function harvestOnePr(opts: {
  owner: string
  repo: string
  pr: number
  mergedSha?: string
  runId: string
  threadAuthor?: string | null
}): Promise<HarvestPrResult> {
  const args: HarvestArgs = {
    owner: opts.owner,
    repo: opts.repo,
    pr: opts.pr,
    mergedSha: opts.mergedSha ?? '',
    runId: opts.runId,
    dryRun: false,
  }

  const config = loadConfig()
  const meta = fetchPrMeta(args)
  const harvestedAt = new Date().toISOString()
  const threads = await fetchReviewThreads({
    owner: opts.owner,
    repo: opts.repo,
    pr: opts.pr,
  })

  const collected = collectHarvestRows({
    threads,
    config,
    meta,
    pr: opts.pr,
    runId: opts.runId,
    harvestedAt,
    threadAuthor: opts.threadAuthor ?? null,
  })

  return { pr: opts.pr, ...collected }
}

function logHarvestResult(result: HarvestPrResult): void {
  console.error(
    `harvest: PR #${result.pr} — ${result.incoming.length} thread(s) harvested, ` +
      `${result.skipped} ignored (config), ${result.skippedOutdated} skipped (outdated), ` +
      `${result.skippedThreadAuthor} skipped (thread-author)`
  )
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  ensureGhAuth()

  const result = await harvestOnePr({
    owner: args.owner,
    repo: args.repo,
    pr: args.pr,
    mergedSha: args.mergedSha,
    runId: args.runId,
  })

  logHarvestResult(result)

  if (args.dryRun) {
    for (const row of result.incoming) {
      console.log(JSON.stringify(row))
    }
    return
  }

  if (result.incoming.length === 0) {
    console.error('harvest: no harvestable threads')
    return
  }

  const harvestedAt = result.incoming[0]!.harvested_at
  const path = writeHarvestFile({
    pr: args.pr,
    runId: args.runId,
    harvestedAt,
    records: result.incoming,
  })
  writeSummary(buildSummary(readDebtRecords()))

  console.error(`harvest: wrote ${result.incoming.length} row(s) to ${path}`)
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
