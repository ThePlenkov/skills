#!/usr/bin/env bun
/**
 * e2e-agent — domain-agnostic AI-native scenario CLI.
 * Project-specific wiring lives in a config + adapter (see SPEC.md).
 */
import { parseCli } from './scripts/framework/context'
import { buildE2eDispatch, runE2eDispatch } from './scripts/framework/dispatch'
import { resolveRepoRoot } from './scripts/framework/evidence'
import { listScenarios, runE2e, showScenarioByCode } from './scripts/framework/execute'
import { loadProjectConfig, resolveConfigPath } from './scripts/framework/project-config'

const USAGE = `e2e-agent — domain-agnostic scenario runner

Usage:
  e2e-agent list [--config <path>] [suite]
  e2e-agent show <code> --config <path>
  e2e-agent run <code> --config <path> [params...] [--evidence] [--agent <id>] [--model <id>]
  e2e-agent dispatch <code> --config <path> [params...] --acp --agent <acp-id>
  e2e-agent help

Config resolution (first wins): --config, E2E_CONFIG env, e2e.config.yaml at repo root.

Examples (OpenADT — see specs/mcp-ai-testing.md):
  bun run e2e -- list
  bun run e2e -- show ls-1
  bun run e2e -- run ls-1 --destination ABC
  bun run e2e -- run mcp-1 --destination ABC --acp --agent devin

Agents: use only these commands. Do not import scripts/framework/*.
`

async function cmdList(argv: string[]): Promise<number> {
  const suite = argv[0] && !argv[0].startsWith('-') ? argv[0] : undefined
  listScenarios(argv, suite)
  return 0
}

async function cmdShow(argv: string[]): Promise<number> {
  const code = argv[0]
  if (!code || code.startsWith('-')) {
    console.error('show requires a scenario code')
    return 1
  }
  await showScenarioByCode(argv, code)
  return 0
}

async function cmdRun(argv: string[]): Promise<number> {
  const opts = parseCli(argv)
  if (opts.executor === 'acp') {
    return cmdDispatch(argv)
  }
  if (!opts.evidence) {
    opts.evidence = true
    process.env.E2E_EVIDENCE = '1'
  }
  const { exitCode } = await runE2e(argv, opts)
  return exitCode
}

async function cmdDispatch(argv: string[]): Promise<number> {
  const opts = parseCli(argv)
  if (opts.executor !== 'acp') {
    console.error('dispatch requires --acp (or --executor=acp) and --agent <acp-id>')
    return 1
  }
  const repoRoot = resolveRepoRoot(process.cwd())
  const configPath = resolveConfigPath(repoRoot, argv)
  const projectConfig = loadProjectConfig(repoRoot, argv)
  const { exitCode } = runE2eDispatch(buildE2eDispatch, opts, repoRoot, {
    configPath,
    projectConfig,
    usageExample: 'e2e-agent dispatch <code> --config <path> --acp --agent <id>',
  })
  return exitCode
}

function isHelpInvocation(command: string | undefined, argv: string[]): boolean {
  if (!command) return true
  if (command === 'help') return true
  return argv.includes('--help') || argv.includes('-h')
}

async function runCommand(command: string, rest: string[]): Promise<number> {
  switch (command) {
    case 'list':
      return cmdList(rest)
    case 'show':
      return cmdShow(rest)
    case 'run':
      return cmdRun(rest)
    case 'dispatch':
      return cmdDispatch(rest)
    default:
      console.error(`Unknown command: ${command}\n`)
      console.log(USAGE)
      return 1
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const [command, ...rest] = argv

  if (isHelpInvocation(command, argv)) {
    console.log(USAGE)
    process.exit(0)
  }

  let exitCode = 1
  try {
    exitCode = await runCommand(command!, rest)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    exitCode = 1
  }
  process.exit(exitCode)
}

main()
