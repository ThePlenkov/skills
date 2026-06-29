#!/usr/bin/env bun
/**
 * Query the review-debt ledger for agents and humans.
 *
 * Usage:
 *   bun run act:debt:query -- --status open
 *   bun run act:debt:query -- --area apps/openadt-cli
 *   bun run act:debt:query -- --duplicates
 *   bun run act:debt:query -- --limit 25 --format tsv
 *   bun run act:debt:query -- --write-summary
 */
import {
  buildSummary,
  readDebtRecords,
  writeSummary,
  type DebtRecord,
} from '../../harvest/scripts/review-debt-lib.ts'

interface QueryArgs {
  status: string | null
  area: string | null
  author: string | null
  duplicatesOnly: boolean
  limit: number | null
  format: 'json' | 'tsv' | 'table'
  writeSummary: boolean
}

function coerceOutputFormat(value: string | null): QueryArgs['format'] | null {
  switch (value) {
    case 'json':
    case 'tsv':
    case 'table':
      return value
    default:
      return null
  }
}

function readOption(argv: string[], index: number): string | null {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    return null
  }
  return value
}

const FLAG_HANDLERS: Record<string, (args: QueryArgs, argv: string[], i: number) => number> = {
  '--duplicates': (args) => {
    args.duplicatesOnly = true
    return 0
  },
  '--write-summary': (args) => {
    args.writeSummary = true
    return 0
  },
  '--status': (args, argv, i) => {
    args.status = readOption(argv, i)
    return 1
  },
  '--area': (args, argv, i) => {
    args.area = readOption(argv, i)
    return 1
  },
  '--author': (args, argv, i) => {
    args.author = readOption(argv, i)
    return 1
  },
  '--limit': (args, argv, i) => {
    args.limit = Number(readOption(argv, i))
    return 1
  },
  '--format': (args, argv, i) => {
    const fmt = coerceOutputFormat(readOption(argv, i))
    if (fmt) {
      args.format = fmt
    }
    return 1
  },
}

function applyQueryFlag(args: QueryArgs, arg: string, argv: string[], i: number): number {
  const handler = FLAG_HANDLERS[arg]
  if (!handler) {
    return i
  }
  return i + handler(args, argv, i)
}

function parseArgs(argv: string[]): QueryArgs {
  const args: QueryArgs = {
    status: null,
    area: null,
    author: null,
    duplicatesOnly: false,
    limit: null,
    format: 'table',
    writeSummary: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    i = applyQueryFlag(args, argv[i]!, argv, i)
  }

  return args
}

function filterRecords(records: DebtRecord[], args: QueryArgs): DebtRecord[] {
  let rows = records

  if (args.status) {
    rows = rows.filter((r) => r.status === args.status)
  }
  if (args.area) {
    rows = rows.filter((r) => r.area.startsWith(args.area!))
  }
  if (args.author) {
    const needle = args.author.toLowerCase()
    rows = rows.filter((r) => r.author.toLowerCase().includes(needle))
  }

  if (args.duplicatesOnly) {
    const counts = new Map<string, number>()
    for (const row of rows) {
      counts.set(row.fingerprint, (counts.get(row.fingerprint) ?? 0) + 1)
    }
    rows = rows.filter((r) => (counts.get(r.fingerprint) ?? 0) > 1)
  }

  if (args.limit !== null && Number.isFinite(args.limit)) {
    rows = rows.slice(0, args.limit)
  }

  return rows
}

function printTsv(rows: DebtRecord[]): void {
  console.log('thread_id\tsource_pr\tpath:line\tpriority\tbody_preview\tthread_url')
  for (const row of rows) {
    const loc = `${row.path}:${row.line ?? '-'}`
    const cols = [
      row.thread_id,
      String(row.source_pr),
      loc,
      row.priority,
      row.body_preview.replace(/\t/g, ' '),
      row.thread_url,
    ]
    console.log(cols.join('\t'))
  }
}

function printTable(rows: DebtRecord[]): void {
  for (const row of rows) {
    console.log(
      `#${row.source_pr} [${row.priority}] ${row.path}:${row.line ?? '-'} — ${row.body_preview}`
    )
    console.log(`  ${row.thread_url}`)
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const records = readDebtRecords()

  if (args.writeSummary) {
    writeSummary(buildSummary(records))
    console.error(`wrote ${records.length} record(s) summary`)
    return
  }

  const rows = filterRecords(records, args)

  if (args.format === 'json') {
    console.log(JSON.stringify(rows, null, 2))
    return
  }
  if (args.format === 'tsv') {
    printTsv(rows)
    return
  }

  printTable(rows)
  console.error(`\n${rows.length} row(s)`)
}

main()
