#!/usr/bin/env bun
/**
 * Update review-debt ledger row status (after /act debt batch PR).
 *
 * Usage:
 *   bun run act:debt:done -- --thread-id PRRT_… --status done --fix-pr 99
 *   bun run act:debt:done -- --fix-pr 99 --status done --threads-file tmp/agent/threads.txt
 *   bun run act:debt:done -- --status wontfix --thread-id PRRT_… --notes "out of scope"
 */
import { readFileSync } from 'node:fs'
import {
  buildSummary,
  readDebtRecords,
  upsertLedgerOverlays,
  writeSummary,
  type DebtStatus,
  type LedgerOverlay,
} from '../../../workflow/harvest/scripts/review-debt-lib.ts'

interface StatusArgs {
  threadIds: string[]
  status: DebtStatus
  fixPr: number | null
  notes: string | null
}

const VALID: DebtStatus[] = ['open', 'claimed', 'done', 'wontfix', 'duplicate']

function readOption(argv: string[], index: number): string | null {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    return null
  }
  return value
}

function parseThreadFile(path: string): string[] {
  const raw = readFileSync(path, 'utf8')
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
}

interface ParseState {
  threadIds: string[]
  status: DebtStatus | null
  fixPr: number | null
  notes: string | null
  threadsFile: string | null
}

function initialState(): ParseState {
  return {
    threadIds: [],
    status: null,
    fixPr: null,
    notes: null,
    threadsFile: null,
  }
}

const STATUS_FLAG_HANDLERS: Record<
  string,
  (state: ParseState, argv: string[], i: number) => number
> = {
  '--thread-id': (state, argv, i) => {
    const id = readOption(argv, i)
    if (id !== null) {
      state.threadIds.push(id)
    }
    return id !== null ? i + 1 : i
  },
  '--threads-file': (state, argv, i) => {
    const file = readOption(argv, i)
    if (file !== null) {
      state.threadsFile = file
    }
    return file !== null ? i + 1 : i
  },
  '--status': (state, argv, i) => {
    const value = readOption(argv, i) as DebtStatus | null
    if (value !== null && VALID.includes(value)) {
      state.status = value
    }
    return value !== null ? i + 1 : i
  },
  '--fix-pr': (state, argv, i) => {
    const val = readOption(argv, i)
    if (val !== null) {
      const n = Number(val)
      if (Number.isFinite(n)) {
        state.fixPr = n
      }
    }
    return val !== null ? i + 1 : i
  },
  '--notes': (state, argv, i) => {
    const val = readOption(argv, i)
    if (val !== null) {
      state.notes = val
    }
    return val !== null ? i + 1 : i
  },
}

function parseArgs(argv: string[]): StatusArgs {
  const state = initialState()

  for (let i = 0; i < argv.length; i += 1) {
    const handler = STATUS_FLAG_HANDLERS[argv[i]!]
    if (handler) {
      i = handler(state, argv, i)
    }
  }

  if (state.threadsFile) {
    state.threadIds.push(...parseThreadFile(state.threadsFile))
  }

  if (!state.status || state.threadIds.length === 0) {
    console.error(
      'Usage: update-debt-status.ts --status done|wontfix|claimed|open|duplicate ' +
        '--thread-id ID [--thread-id ID2 …] | --threads-file PATH ' +
        '[--fix-pr N] [--notes TEXT]'
    )
    process.exit(2)
  }

  return {
    threadIds: [...new Set(state.threadIds)],
    status: state.status,
    fixPr: state.fixPr,
    notes: state.notes,
  }
}

function isTerminalStatus(status: DebtStatus): boolean {
  return status === 'done' || status === 'wontfix'
}

function applyStatus(args: StatusArgs): { updated: number; missing: string[] } {
  const records = readDebtRecords()
  const byId = new Map(records.map((r) => [r.thread_id, r]))
  const missing = args.threadIds.filter((id) => !byId.has(id))
  const now = new Date().toISOString()

  const updates: LedgerOverlay[] = args.threadIds
    .filter((id) => byId.has(id))
    .map((thread_id) => {
      const prev = byId.get(thread_id)!
      return {
        thread_id,
        status: args.status,
        fix_pr: isTerminalStatus(args.status) ? (args.fixPr ?? prev.fix_pr) : null,
        fixed_at: isTerminalStatus(args.status) ? now : null,
        notes: args.notes ?? prev.notes,
      }
    })

  upsertLedgerOverlays(updates)
  writeSummary(buildSummary(readDebtRecords()))

  return { updated: updates.length, missing }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const result = applyStatus(args)

  console.error(`update-debt-status: ${result.updated} row(s) → ${args.status}`)
  if (result.missing.length > 0) {
    console.error(`warning: thread id(s) not in ledger: ${result.missing.join(', ')}`)
    process.exit(1)
  }
}

main()
