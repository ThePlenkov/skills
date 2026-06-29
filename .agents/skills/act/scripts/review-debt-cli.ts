#!/usr/bin/env bun
/**
 * Entry point for the review-debt side of /act (`bun run act:debt:*`).
 *
 * The harvest side now lives in /harvest (see .agents/skills/harvest/SKILL.md).
 * Debt here means: read the ledger built by /harvest, batch-fix it on a branch,
 * then update status. Scripts:
 *
 *   bun run act:debt:query -- --status open --format tsv
 *   bun run act:debt:plan -- --limit 25
 *   bun run act:debt:done -- --status done --fix-pr 99 --thread-id PRRT_…
 *   bun run act:debt:test
 */
import { spawnSync } from 'node:child_process'

const SCRIPT_DIR = import.meta.dir

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
  const result = spawnSync('bun', [joinScript(script), ...args], {
    stdio: 'inherit',
  })
  if (result.error) {
    throw result.error
  }
  return result.status ?? 1
}

function joinScript(name: string): string {
  return `${SCRIPT_DIR}/${name}`
}

function runTests(): number {
  const tests = [
    `${SCRIPT_DIR}/../../harvest/scripts/review-debt-lib.test.ts`,
    `${SCRIPT_DIR}/../../harvest/scripts/resolve-harvest-prs.test.ts`,
    `${SCRIPT_DIR}/../../harvest/scripts/resolve-harvest-target.test.ts`,
    `${SCRIPT_DIR}/update-debt-status.test.ts`,
  ]
  const result = spawnSync('bun', ['test', ...tests], { stdio: 'inherit' })
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

if (import.meta.main) {
  main()
}
