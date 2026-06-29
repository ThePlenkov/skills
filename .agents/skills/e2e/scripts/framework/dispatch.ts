import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CliOptions } from './context'
import {
  ACP_AGENTS_URL,
  ACP_GET_STARTED_URL,
  buildRunContext,
  resolveAcpAgent,
  resolveE2eModel,
} from './context'
import { defaultEvidenceRoot } from './evidence'
import { filterScenarios, loadScenariosFromDir } from './scenarios'
import type { ProjectE2eConfig } from './project-config'
import { resolveSuiteId, suiteDir } from './project-config'
import type { RunContext } from './types'

export type E2eDispatchPayload = {
  version: 1
  runId: string
  createdAt: string
  executor: 'acp'
  acpAgent: string
  dispatchedFrom: string
  repoRoot: string
  scenario: string
  scenarioFile: string
  ctx: Record<string, unknown>
  command: { local: string }
  prompt: string
  env: Record<string, string>
  evidenceDir: string
  skillPath: string
  specPath: string
  acpDocs: { agents: string; getStarted: string }
  status: 'pending'
}

function dispatchTimestamp(at: Date = new Date()): string {
  return at
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/:/g, '-')
}

export function dispatchRunId(testId: string, at: Date = new Date()): string {
  const suffix = randomBytes(4).toString('hex')
  const safeId = testId.replace(/[^\w.-]+/g, '-')
  return `${dispatchTimestamp(at)}-dispatch-${safeId}-${suffix}`
}

export function defaultDispatchRoot(repoRoot: string): string {
  return join(repoRoot, '.e2e', 'dispatch')
}

function shellQuote(value: string): string {
  if (/^[\w@./:=+-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

type LocalRunCommandInput = {
  scenario: string
  configPath: string
  ctx: RunContext
  agent: string
  model: string
}

function buildLocalRunCommand(input: LocalRunCommandInput): string {
  const { scenario, configPath, ctx, agent, model } = input
  const parts = [
    'bun',
    '.agents/skills/e2e/cli.ts',
    'run',
    shellQuote(scenario),
    '--config',
    shellQuote(configPath),
    '--evidence',
    ...Object.entries(ctx)
      .filter(([k]) => k !== 'prompt')
      .flatMap(([k, v]) => [shellQuote(`--${k}`), shellQuote(String(v))]),
    '--agent',
    shellQuote(agent),
  ]
  if (model && !model.startsWith('(none')) {
    parts.push('--model', shellQuote(model))
  }
  return parts.join(' ')
}

function assertDispatchSupported(opts: CliOptions, usageExample: string): string {
  if (opts.list) {
    throw new Error('Dispatch does not support --list; run without --acp.')
  }
  const scenarioKey = opts.scenario?.trim()
  if (!scenarioKey) {
    throw new Error(`Dispatch requires a scenario code. Usage: ${usageExample}`)
  }
  return scenarioKey
}

function relativeConfigPath(configPath: string, repoRoot: string): string {
  if (configPath.startsWith(repoRoot)) {
    return configPath.slice(repoRoot.length + 1)
  }
  return configPath
}

function resolveDispatchScenario(
  projectConfig: ProjectE2eConfig,
  repoRoot: string,
  scenarioKey: string
): { suiteId: string; scenario: Scenario; scenarioFilePath: string } {
  const suiteId = resolveSuiteId(projectConfig, scenarioKey)
  const suite = projectConfig.suites[suiteId]!
  const scenarios = filterScenarios(loadScenariosFromDir(suiteDir(repoRoot, suite)), scenarioKey)
  const scenario = scenarios[0]!
  return { suiteId, scenario, scenarioFilePath: join(suite.dir, scenario.file) }
}

function buildAcpPrompt(input: {
  scenario: string
  scenarioFilePath: string
  ctx: RunContext
  localCommand: string
  acpAgent: string
  specPath?: string
}): string {
  const ctxSummary = Object.entries(input.ctx)
    .filter(([k]) => k !== 'prompt')
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
  const lines = [
    `Run E2E scenario ${input.scenario}${ctxSummary ? ` with context: ${ctxSummary}` : ''}.`,
    '',
    'Use the e2e-agent CLI only (do not import framework modules):',
    `1. Read scenario: ${input.scenarioFilePath}`,
    `2. Execute: ${input.localCommand}`,
    '3. Report PASS/FAIL, exit code, and E2E_EVIDENCE_FILE path.',
    '4. Summarize Given/When/Then and assertion table highlights (no secrets).',
    '',
    'Evidence lands under .e2e/results/',
    '',
    `ACP agent: ${input.acpAgent} (${ACP_AGENTS_URL})`,
  ]
  if (input.specPath) lines.push('', `Project spec: ${input.specPath}`)
  return lines.join('\n')
}

export type DispatchBuildConfig = {
  configPath: string
  projectConfig: ProjectE2eConfig
  usageExample: string
}

export function buildE2eDispatch(
  opts: CliOptions,
  repoRoot: string,
  config: DispatchBuildConfig
): E2eDispatchPayload {
  const scenarioKey = assertDispatchSupported(opts, config.usageExample)
  const acpAgent = resolveAcpAgent(opts)
  const { scenario, scenarioFilePath } = resolveDispatchScenario(
    config.projectConfig,
    repoRoot,
    scenarioKey
  )
  const model = resolveE2eModel(opts)
  const evidenceDir = opts.evidenceRoot ?? defaultEvidenceRoot(repoRoot)
  const ctx = buildRunContext(opts)
  const relConfig = relativeConfigPath(config.configPath, repoRoot)
  const localCommand = buildLocalRunCommand({
    scenario: scenario.code,
    configPath: relConfig,
    ctx,
    agent: acpAgent,
    model,
  })
  const prompt = buildAcpPrompt({
    scenario: scenario.code,
    scenarioFilePath,
    ctx,
    localCommand,
    acpAgent,
    specPath: config.projectConfig.specPath,
  })
  const env = buildDispatchEnv({ acpAgent, ctx, model: opts.model })
  const runId = dispatchRunId(scenario.code)

  return {
    version: 1,
    runId,
    createdAt: new Date().toISOString(),
    executor: 'acp',
    acpAgent,
    dispatchedFrom: process.env.E2E_DISPATCHED_FROM?.trim() || 'cursor',
    repoRoot,
    scenario: scenario.code,
    scenarioFile: scenario.file,
    ctx,
    command: { local: localCommand },
    env,
    prompt,
    evidenceDir,
    skillPath: '.agents/skills/e2e/SKILL.md',
    specPath: config.projectConfig.specPath ?? '',
    acpDocs: { agents: ACP_AGENTS_URL, getStarted: ACP_GET_STARTED_URL },
    status: 'pending',
  }
}

function buildDispatchEnv(args: {
  acpAgent: string
  ctx: RunContext
  model: string | undefined
}): Record<string, string> {
  const env: Record<string, string> = {
    E2E_AGENT: args.acpAgent,
    E2E_EVIDENCE: '1',
    ACP_AGENT: args.acpAgent,
  }
  Object.entries(args.ctx)
    .filter(([k]) => k !== 'prompt')
    .forEach(([k, v]) => {
      env[`E2E_${k.toUpperCase()}`] = String(v)
    })
  const model = args.model?.trim()
  if (model) env.E2E_MODEL = model
  return env
}

export function writeDispatchFile(root: string, payload: E2eDispatchPayload): string {
  mkdirSync(root, { recursive: true })
  const path = join(root, `${payload.runId}.json`)
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return path
}

export function formatDispatchInstructions(payload: E2eDispatchPayload): string {
  const dispatchPath = join(payload.repoRoot, '.e2e', 'dispatch', `${payload.runId}.json`)
  const ctxSummary = Object.entries(payload.ctx)
    .filter(([k]) => k !== 'prompt')
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
  const lines = [
    'E2E dispatch — ACP external executor',
    '',
    `Run id:      ${payload.runId}`,
    `Scenario:    ${payload.scenario} (${payload.scenarioFile})`,
    ...(ctxSummary ? [`Context:     ${ctxSummary}`] : []),
    `ACP agent:   ${payload.acpAgent}`,
    `Dispatch:    ${dispatchPath}`,
    '',
    'Submit the prompt below through your ACP client.',
    'The external agent runs:',
    '',
    payload.command.local,
    '',
    '--- prompt ---',
    payload.prompt,
    '---',
    '',
    'When complete, read E2E_EVIDENCE_FILE from output under .e2e/results/.',
  ]
  return lines.join('\n')
}

export type RunE2eDispatchOutcome = {
  exitCode: number
  dispatchPath?: string
}

export function runE2eDispatch(
  build: (opts: CliOptions, repoRoot: string, config: DispatchBuildConfig) => E2eDispatchPayload,
  opts: CliOptions,
  repoRoot: string,
  config: DispatchBuildConfig
): RunE2eDispatchOutcome {
  try {
    const payload = build(opts, repoRoot, config)
    const dispatchPath = writeDispatchFile(defaultDispatchRoot(repoRoot), payload)
    console.log(formatDispatchInstructions(payload))
    console.log(`\nE2E_DISPATCH_FILE=${dispatchPath}`)
    return { exitCode: 0, dispatchPath }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`E2E dispatch failed: ${message}`)
    return { exitCode: 1 }
  }
}
