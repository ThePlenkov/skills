import type { RunContext } from './types'
import { readE2eAgentConfig, resolveRepoRoot } from './evidence'

export const DEFAULT_E2E_AGENT = 'e2e-runner'
export const DEFAULT_E2E_MODEL = '(none — deterministic runner)'

export const ACP_AGENTS_URL = 'https://agentclientprotocol.com/overview/agents'
export const ACP_GET_STARTED_URL = 'https://agentclientprotocol.com/get-started/introduction'

/** Who runs the scenario (local vs external ACP agent). */
export type E2eExecutor = 'local' | 'acp'

export const ACP_EXECUTOR_ALIASES = ['acp'] as const

export type CliOptions = {
  /** Framework behavior flags */
  scenario?: string
  list: boolean
  evidence: boolean
  evidenceRoot?: string
  agent?: string
  model?: string
  executor: E2eExecutor
  prompt?: string
  autoclean?: boolean
  /** Arbitrary dynamic arguments for AI interpretation (e.g., --destination=ABC, --user=foo) */
  args: Record<string, string | boolean | number>
}

export function getCliFlag(argv: string[], flag: string): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === flag) {
      const next = argv[i + 1]
      return next && !next.startsWith('-') ? next : undefined
    }
    const prefix = `${flag}=`
    if (arg.startsWith(prefix)) {
      const value = arg.slice(prefix.length)
      return value.length > 0 ? value : undefined
    }
  }
  return undefined
}

const LOCAL_EXECUTOR_ALIASES = ['local', 'cursor', 'e2e-runner'] as const

function isLocalExecutorAlias(norm: string): boolean {
  return (LOCAL_EXECUTOR_ALIASES as readonly string[]).includes(norm)
}

function isAcpExecutorAlias(norm: string): boolean {
  return (ACP_EXECUTOR_ALIASES as readonly string[]).includes(norm)
}

function resolveExecutorFromFlag(raw: string): E2eExecutor {
  const norm = raw.toLowerCase().trim()
  if (isLocalExecutorAlias(norm)) return 'local'
  if (isAcpExecutorAlias(norm)) return 'acp'
  throw new Error(`Unknown executor "${raw}". Use acp (or --acp), or omit for local execution.`)
}

export function resolveE2eExecutor(argv: string[]): E2eExecutor {
  if (argv.includes('--acp')) return 'acp'
  const raw = getCliFlag(argv, '--command') ?? getCliFlag(argv, '--executor')
  if (!raw) return 'local'
  return resolveExecutorFromFlag(raw)
}

export function resolveE2eAgent(opts: CliOptions): string {
  return opts.agent?.trim() || DEFAULT_E2E_AGENT
}

/** ACP registry agent id for dispatch — user-supplied, never defaulted. */
export function resolveAcpAgent(opts: CliOptions): string {
  const id = opts.agent?.trim() ?? process.env.ACP_AGENT?.trim()
  if (!id) {
    throw new Error(
      `ACP dispatch requires --agent <acp-agent-id> or env ACP_AGENT. ` + `See ${ACP_AGENTS_URL}`
    )
  }
  return id
}

export function resolveE2eModel(opts: CliOptions): string {
  return opts.model?.trim() || DEFAULT_E2E_MODEL
}

export function resolveE2eExecution(agent: string): string {
  return agent === DEFAULT_E2E_AGENT
    ? 'framework (deterministic tool calls, no LLM in loop)'
    : 'agent-orchestrated (LLM invoked runner; tool calls still deterministic via framework)'
}

function positionalScenario(argv: string[]): string | undefined {
  for (const arg of argv) {
    if (arg.startsWith('-')) continue
    return arg
  }
  return undefined
}

function parseDynamicArg(
  arg: string,
  argv: string[],
  i: number
): { name: string; value: string | boolean; consumed: number } {
  const eq = arg.indexOf('=')
  if (eq !== -1) {
    return { name: arg.slice(2, eq), value: arg.slice(eq + 1), consumed: 0 }
  }
  const next = argv[i + 1]
  if (next && !next.startsWith('-')) {
    return { name: arg.slice(2), value: next, consumed: 1 }
  }
  return { name: arg.slice(2), value: true, consumed: 0 }
}

const FRAMEWORK_FLAGS = new Set([
  '--scenario',
  '--config',
  '--list',
  '--evidence',
  '--evidence-dir',
  '--agent',
  '--model',
  '--acp',
  '--command',
  '--executor',
  '--prompt',
  '--autoclean',
  '--suite',
])

function collectDynamicArgs(argv: string[]): Record<string, string | boolean | number> {
  const args: Record<string, string | boolean | number> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg?.startsWith('--')) continue
    if (FRAMEWORK_FLAGS.has(arg)) continue
    const parsed = parseDynamicArg(arg, argv, i)
    args[parsed.name] = parsed.value
    i += parsed.consumed
  }
  return args
}

function resolveAutoclean(
  argv: string[],
  projectConfig: ReturnType<typeof readE2eAgentConfig>
): boolean {
  if (argv.includes('--autoclean')) return true
  if (process.env.E2E_AUTOCLEAN === '1') return true
  return projectConfig.autoclean === true
}

function resolveEvidenceFlag(argv: string[]): boolean {
  if (argv.includes('--evidence')) return true
  return process.env.E2E_EVIDENCE === '1'
}

function resolveAgent(
  argv: string[],
  get: (flag: string) => string | undefined
): string | undefined {
  return get('--agent') ?? process.env.E2E_AGENT?.trim()
}

function resolveModel(
  argv: string[],
  get: (flag: string) => string | undefined
): string | undefined {
  return get('--model') ?? process.env.E2E_MODEL?.trim()
}

export function parseCli(argv: string[]): CliOptions {
  const get = (flag: string): string | undefined => getCliFlag(argv, flag)
  const repoRoot = resolveRepoRoot(process.cwd())
  const projectConfig = readE2eAgentConfig(repoRoot, argv)

  return {
    scenario: get('--scenario') ?? positionalScenario(argv),
    list: argv.includes('--list'),
    evidence: resolveEvidenceFlag(argv),
    evidenceRoot: get('--evidence-dir'),
    agent: resolveAgent(argv, get),
    model: resolveModel(argv, get),
    executor: resolveE2eExecutor(argv),
    prompt: get('--prompt'),
    autoclean: resolveAutoclean(argv, projectConfig),
    args: collectDynamicArgs(argv),
  }
}

/**
 * Build RunContext from parsed CLI options.
 * AI agent maps user input to actual parameters using the skill spec.
 */
export function buildRunContext(opts: CliOptions): RunContext {
  return {
    ...opts.args,
    prompt: opts.prompt,
  }
}
