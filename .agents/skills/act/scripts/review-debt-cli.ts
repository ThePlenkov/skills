#!/usr/bin/env bun
/**
 * Entry point for the review-debt side of /act (`bun run act:debt:*` or
 * `npx tsx scripts/run.ts ... review-debt-cli.ts`).
 *
 * Runtime: `bun` (direct) or `npx --yes tsx@4` (Node.js ≥ 18). No Bun-specific
 * APIs are used — the script imports only `node:` built-ins.
 *
 * The companion collection step now lives in its own skill.
 * Debt here means: read the ledger built by /harvest, batch-fix it on a branch,
 * then update status. Scripts:
 *
 *   bun run act:debt:query -- --status open --format tsv
 *   bun run act:debt:plan -- --limit 25
 *   bun run act:debt:done -- --status done --fix-pr 99 --thread-id PRRT_…
 *   bun run act:debt:test
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

/**
 * Detect whether we are running under Bun. Bun sets `process.versions.bun`;
 * Node does not. This determines how to launch child TypeScript scripts:
 * - Bun: `bun script.ts` (direct execution)
 * - Node + tsx: `node --import tsx script.ts` (propagate the tsx loader)
 */
const IS_BUN = typeof (process.versions as { bun?: string }).bun === 'string'

/**
 * Build the argv for launching a child TypeScript script under the current
 * runtime. Under Bun, `process.execPath` is `bun` and can run `.ts` directly.
 * Under Node + tsx, `process.execPath` is `node` and needs `--import tsx` to
 * handle TypeScript — `process.execArgv` carries the loader flags when tsx
 * was loaded, so we propagate them.
 */
function runtimeArgs(scriptPath: string, args: string[]): string[] {
  if (IS_BUN) {
    return [scriptPath, ...args]
  }
  // Node + tsx: propagate the loader flags from the current process so child
  // scripts can also run TypeScript. process.execArgv contains flags like
  // `--import=tsx` or `--require=tsx` when running under tsx.
  return [...process.execArgv, scriptPath, ...args]
}

const RUNTIME = process.execPath

const SUBCOMMANDS = {
  query: 'query-debt.ts',
  plan: 'plan-debt-batch.ts',
  done: 'update-debt-status.ts',
} as const

type Subcommand = keyof typeof SUBCOMMANDS

function usage(): never {
  console.error(`Usage:
  bun run act:debt:<cmd> -- [args…]

Commands:
  query         Query ledger (--status, --area, --duplicates, …)
  plan          Build /act debt batch plan
  done          Update row status (--status, --thread-id, --fix-pr, …)
  test          Run review-debt unit tests

Examples:
  bun run act:debt:query -- --status open --limit 25 --format tsv
  bun run act:debt:plan -- --limit 25 --out tmp/agent_$$/debt-batch-plan.md
  bun run act:debt:done -- --status done --fix-pr 99 --thread-id PRRT_…`)
  process.exit(1)
}
function runBun(script: string, args: string[]): number {
  const result = spawnSync(RUNTIME, runtimeArgs(joinScript(script), args), {
    stdio: 'inherit',
  })
  if (result.error) {
    throw result.error
  }
  return result.status ?? 1
}

function joinScript(name: string): string {
  return join(SCRIPT_DIR, name)
}

function runTests(): number {
  const tests = [
    join(SCRIPT_DIR, '../../../workflow/harvest/scripts/review-debt-lib.test.ts'),
    join(SCRIPT_DIR, '../../../workflow/harvest/scripts/resolve-harvest-prs.test.ts'),
    join(SCRIPT_DIR, '../../../workflow/harvest/scripts/resolve-harvest-target.test.ts'),
    join(SCRIPT_DIR, 'update-debt-status.test.ts'),
  ]
  if (!IS_BUN) {
    console.error(
      'The "test" subcommand requires Bun (`bun test`). ' +
        'Install Bun or run tests directly: `bun test ' + tests.join(' ') + '`',
    )
    return 1
  }
  const result = spawnSync(RUNTIME, ['test', ...tests], { stdio: 'inherit' })
  if (result.error) {
    throw result.error
  }
  return result.status ?? 1
}

function wantsUsage(cmd: string | undefined): boolean {
  if (!cmd) {
    return true
  }
  return cmd === '--help' || cmd === '-h'
}

function subcommandScript(cmd: string): string {
  const script = SUBCOMMANDS[cmd as Subcommand]
  if (script) {
    return script
  }
  console.error(`Unknown command: ${cmd}`)
  usage()
}

function runCommand(cmd: string, rest: string[]): number {
  if (cmd === 'test') {
    return runTests()
  }
  const script = subcommandScript(cmd)
  return runBun(script, rest)
}

function main(): void {
  const [cmd, ...rest] = process.argv.slice(2)
  if (wantsUsage(cmd)) {
    usage()
  }
  process.exit(runCommand(cmd!, rest))
}

// Windows-safe entrypoint check: convert process.argv[1] (a filesystem path
// like C:\foo\bar.ts on Windows) to a file:// URL before comparing with
// import.meta.url. Guard against missing argv[1] (e.g. piped via -e).
const isMain = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false

if (isMain) {
  main()
}
