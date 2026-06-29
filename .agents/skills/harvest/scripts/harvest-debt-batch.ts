#!/usr/bin/env bun
/**
 * Harvest review debt from multiple merged PRs matching filters.
 *
 * Usage:
 *   bun run act:debt:harvest -- --pr-ids 72,67
 *   bun run act:debt:harvest -- --merged-since 2026-06-09 --last 5
 *   bun run act:debt:harvest -- --pr-author cursor --labels enhancement
 *   bun run act:debt:harvest -- --last 10 --thread-author codeant-ai --dry-run
 */
import { buildSummary, readDebtRecords, writeHarvestFile, writeSummary } from './review-debt-lib.ts'
import { ensureGhAuth } from './review-debt-gh.ts'
import { harvestOnePr } from './harvest-threads.ts'
import {
  hasHarvestSelection,
  parseCsvInts,
  parseCsvStrings,
  resolveHarvestPrs,
  type HarvestPrFilters,
} from './resolve-harvest-prs.ts'

interface BatchArgs {
  owner: string
  repo: string
  filters: HarvestPrFilters
  threadAuthor: string | null
  runId: string
  dryRun: boolean
  listOnly: boolean
}

function readOption(argv: string[], index: number): string | null {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    return null
  }
  return value
}

interface BatchParseState {
  positional: string[]
  filters: HarvestPrFilters
  threadAuthor: string | null
  runId: string
  dryRun: boolean
  listOnly: boolean
}

function initialBatchState(): BatchParseState {
  return {
    positional: [],
    filters: {
      prIds: [],
      mergedSince: null,
      mergedUntil: null,
      lastN: null,
      prAuthor: null,
      labels: [],
    },
    threadAuthor: null,
    runId: 'local',
    dryRun: false,
    listOnly: false,
  }
}

const BATCH_FLAG_HANDLERS: Record<
  string,
  (state: BatchParseState, argv: string[], i: number) => number
> = {
  '--dry-run': (state) => {
    state.dryRun = true
    return 0
  },
  '--list-only': (state) => {
    state.listOnly = true
    return 0
  },
  '--pr-ids': (state, argv, i) => {
    state.filters.prIds = parseCsvInts(readOption(argv, i))
    return 1
  },
  '--merged-since': (state, argv, i) => {
    state.filters.mergedSince = readOption(argv, i)
    return 1
  },
  '--merged-until': (state, argv, i) => {
    state.filters.mergedUntil = readOption(argv, i)
    return 1
  },
  '--last': (state, argv, i) => {
    const n = Number(readOption(argv, i))
    state.filters.lastN = Number.isFinite(n) ? n : null
    return 1
  },
  '--pr-author': (state, argv, i) => {
    state.filters.prAuthor = readOption(argv, i)
    return 1
  },
  '--labels': (state, argv, i) => {
    state.filters.labels = parseCsvStrings(readOption(argv, i))
    return 1
  },
  '--thread-author': (state, argv, i) => {
    state.threadAuthor = readOption(argv, i)
    return 1
  },
  '--run-id': (state, argv, i) => {
    const id = readOption(argv, i)
    if (id) {
      state.runId = id
    }
    return 1
  },
}

function parseBatchArgs(argv: string[]): BatchArgs {
  const state = initialBatchState()

  for (let i = 0; i < argv.length; i += 1) {
    const handler = BATCH_FLAG_HANDLERS[argv[i]!]
    if (handler) {
      i += handler(state, argv, i)
      continue
    }
    state.positional.push(argv[i]!)
  }

  const [owner, repo] = state.positional
  if (!owner || !repo) {
    printBatchUsage()
    process.exit(2)
  }

  if (!hasHarvestSelection(state.filters)) {
    console.error('error: provide at least one PR selection filter')
    process.exit(2)
  }

  return {
    owner,
    repo,
    filters: state.filters,
    threadAuthor: state.threadAuthor,
    runId: state.runId,
    dryRun: state.dryRun,
    listOnly: state.listOnly,
  }
}

function printBatchUsage(): void {
  console.error(
    'Usage: harvest-debt-batch.ts OWNER REPO [filters] [--dry-run] [--list-only]\n' +
      'Filters (at least one): --pr-ids 72,67 | --merged-since YYYY-MM-DD | ' +
      '--merged-until YYYY-MM-DD | --last N | --pr-author LOGIN | --labels a,b\n' +
      'Thread filter: --thread-author LOGIN (review comment author)'
  )
}

async function harvestPrList(args: BatchArgs, prs: { number: number }[]): Promise<number> {
  let totalRows = 0

  for (const pr of prs) {
    const result = await tryHarvestPr(args, pr.number)
    if (!result) {
      continue
    }
    if (args.dryRun) {
      for (const row of result.incoming) {
        console.log(JSON.stringify(row))
      }
      continue
    }
    if (result.incoming.length === 0) {
      continue
    }
    writeHarvestFile({
      pr: result.pr,
      runId: args.runId,
      harvestedAt: result.incoming[0]!.harvested_at,
      records: result.incoming,
    })
    totalRows += result.incoming.length
  }

  if (!args.dryRun && totalRows > 0) {
    writeSummary(buildSummary(readDebtRecords()))
  }
  return totalRows
}

async function tryHarvestPr(
  args: BatchArgs,
  prNumber: number
): Promise<Awaited<ReturnType<typeof harvestOnePr>> | null> {
  try {
    const result = await harvestOnePr({
      owner: args.owner,
      repo: args.repo,
      pr: prNumber,
      runId: args.runId,
      threadAuthor: args.threadAuthor,
    })
    console.error(`harvest: PR #${result.pr} — ${result.incoming.length} thread(s)`)
    return result
  } catch (err) {
    console.error(`warning: PR #${prNumber} skipped — ${err instanceof Error ? err.message : err}`)
    return null
  }
}

async function main(): Promise<void> {
  const args = parseBatchArgs(process.argv.slice(2))
  ensureGhAuth()

  const prs = resolveHarvestPrs({
    owner: args.owner,
    repo: args.repo,
    filters: args.filters,
  })

  console.error(
    `harvest-batch: ${prs.length} merged PR(s) matched filters: ${prs.map((p) => p.number).join(', ') || '(none)'}`
  )

  if (args.listOnly) {
    for (const pr of prs) {
      console.log(`${pr.number}\t${pr.mergedAt}\t${pr.author}`)
    }
    return
  }

  if (prs.length === 0) {
    return
  }

  const totalRows = await harvestPrList(args, prs)
  if (!args.dryRun) {
    console.error(`harvest-batch: wrote ${totalRows} new row(s) across ${prs.length} PR(s)`)
  }
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
