import type { E2eProjectAdapter } from './adapter-types'
import { evaluateAssert, extractToolPayload } from './assertions'
import type { CliOptions } from './context'
import { buildRunContext } from './context'
import {
  autocleanOldEvidence,
  createEvidencePath,
  defaultEvidenceRoot,
  readE2eAgentConfig,
  resolveRepoRoot,
  writeEvidenceReport,
} from './evidence'
import type { ProjectE2eConfig } from './project-config'
import { loadProjectAdapter } from './adapter-loader'
import { loadProjectConfig, resolveSuiteId, suiteDir } from './project-config'
import { filterScenarios, loadScenariosFromDir } from './scenarios'
import { redact, substituteArgs, substituteAssert } from './template'
import type { RunContext, Scenario, ScenarioResult, StepResult } from './types'

export type RunE2eOutcome = {
  exitCode: number
  evidencePath?: string
}

function mergeContext(
  adapter: E2eProjectAdapter,
  opts: CliOptions,
  suiteId: string
): Promise<RunContext> {
  const base = buildRunContext(opts)
  if (!adapter.resolveParams) return Promise.resolve(base)
  return Promise.resolve(adapter.resolveParams(opts.args, suiteId)).then((resolved) => ({
    ...base,
    ...resolved,
  }))
}

async function runScenarioSteps(
  adapter: E2eProjectAdapter,
  scenario: Scenario,
  ctx: RunContext,
  suiteId: string
): Promise<ScenarioResult> {
  console.log(`--- ${scenario.code} ${scenario.id}: ${scenario.title} ---`)
  const executor = adapter.createExecutor(scenario, ctx, suiteId)
  const steps: StepResult[] = []
  try {
    await executor.start()
    for (const step of scenario.steps) {
      const args = substituteArgs(step.args, ctx)
      const t0 = Date.now()
      let result: unknown
      try {
        result = await executor.callTool(step.tool, args)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`✗ ${step.tool}: ${redact(msg, ctx)}`)
        steps.push({
          tool: step.tool,
          ok: false,
          detail: msg,
          durationMs: Date.now() - t0,
          args,
          isError: true,
          checks: [
            {
              name: 'service_replied',
              expected: 'Tool returned a response',
              actual: `transport error: ${msg}`,
              passed: false,
            },
          ],
        })
        continue
      }
      const payload = extractToolPayload(result)
      const verdict = evaluateAssert(substituteAssert(step.assert, ctx), payload)
      const icon = verdict.ok ? '✓' : '✗'
      console.log(`${icon} ${step.tool}: ${redact(verdict.detail, ctx)}`)
      steps.push({
        tool: step.tool,
        ok: verdict.ok,
        detail: verdict.detail,
        durationMs: Date.now() - t0,
        args,
        isError: payload.isError,
        checks: verdict.checks,
        responseBody: redact(payload.contentText.slice(0, 4000), ctx),
      })
    }
  } finally {
    executor.close()
  }
  return {
    code: scenario.code,
    id: scenario.id,
    title: scenario.title,
    passed: steps.every((s) => s.ok),
    steps,
  }
}

function printSummary(results: ScenarioResult[]): void {
  const passed = results.filter((r) => r.passed).length
  console.log(`\n=== Summary: ${passed}/${results.length} scenarios passed ===`)
  for (const r of results) {
    console.log(`${r.passed ? '✓' : '✗'} ${r.code} ${r.id}`)
  }
}

export function printCatalog(scenarios: Scenario[], suiteLabel?: string): void {
  const header = suiteLabel
    ? `Scenarios (${suiteLabel}):`
    : 'Scenarios (pass runtime params at run time):'
  console.log(`${header}\n`)
  for (const s of scenarios) {
    console.log(`• ${s.code} — ${s.title}`)
    console.log(`  id: ${s.id}`)
    console.log(`  file: ${s.file}`)
    const preview = s.intent.replace(/\s+/g, ' ').slice(0, 100)
    console.log(`  brief: ${preview}…\n`)
  }
}

export function showScenario(scenario: Scenario): void {
  console.log(`${scenario.code} — ${scenario.title}`)
  console.log(`id: ${scenario.id}`)
  console.log(`file: ${scenario.file}`)
  console.log(`\nGiven:\n${scenario.given}`)
  console.log(`\nWhen:\n${scenario.when}`)
  console.log(`\nThen:\n${scenario.then}`)
  console.log(`\nSteps: ${scenario.steps.length}`)
}

type RunSelectionInput = {
  adapter: ProjectAdapter
  selected: Scenario[]
  ctx: RunContext
  suiteId: string
  timeoutMs: number
}

async function runSelectedScenarios(input: RunSelectionInput): Promise<ScenarioResult[]> {
  const { adapter, selected, ctx, suiteId, timeoutMs } = input
  const timeout = setTimeout(() => {
    console.error('Run timeout — remote logon or handshake may be stuck')
  }, timeoutMs).unref()
  const results: ScenarioResult[] = []
  try {
    for (const scenario of selected) {
      results.push(await runScenarioSteps(adapter, scenario, ctx, suiteId))
    }
    printSummary(results)
  } finally {
    clearTimeout(timeout)
  }
  return results
}

type EvidenceWriteInput = {
  evidenceRoot: string
  testId: string
  exitCode: number
  startedAt: string
  opts: CliOptions
  ctx: RunContext
  selected: Scenario[]
  results: ScenarioResult[]
  serviceMode: string
}

function writeRunEvidence(input: EvidenceWriteInput): string {
  const { evidenceRoot, testId, exitCode, startedAt, opts, ctx, selected, results, serviceMode } =
    input
  const { path } = createEvidencePath(evidenceRoot, testId, exitCode === 0, startedAt)
  writeEvidenceReport({
    path,
    runId: path.split(/[/\\]/).pop()!.replace('.md', ''),
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode,
    opts,
    ctx,
    scenarios: selected,
    results,
    serviceMode,
  })
  console.log(`\nEvidence written: ${path}`)
  console.log(`E2E_EVIDENCE_FILE=${path}`)
  return path
}

type RunInputs = {
  selected: Scenario[]
  ctx: RunContext
  startedAt: string
  evidenceRoot: string
  testId: string
  suiteId: string
  serviceMode: string
}

type PrepareRunInputsArgs = {
  argv: string[]
  opts: CliOptions
  repoRoot: string
  adapter: ProjectAdapter
  projectConfig: ProjectE2eConfig
}

async function prepareRunInputs(args: PrepareRunInputsArgs): Promise<RunInputs> {
  const { argv, opts, repoRoot, adapter, projectConfig } = args
  const scenarioKey = opts.scenario?.trim()
  if (!scenarioKey) {
    throw new Error('run requires a scenario code (e.g. test-1).')
  }
  const suiteId = resolveSuiteId(projectConfig, scenarioKey)
  const suite = projectConfig.suites[suiteId]!
  const allInSuite = loadScenariosFromDir(suiteDir(repoRoot, suite))
  const selected = filterScenarios(allInSuite, scenarioKey)
  const ctx = await mergeContext(adapter, opts, suiteId)
  const evidenceRoot = opts.evidenceRoot ?? defaultEvidenceRoot(repoRoot)
  const serviceMode = adapter.serviceMode?.(selected[0]!, suiteId) ?? `suite:${suiteId}`

  const agentConfig = readE2eAgentConfig(repoRoot, argv)
  if (opts.autoclean || agentConfig.autoclean) {
    for (const s of selected) autocleanOldEvidence(evidenceRoot, s.code)
  }

  return {
    selected,
    ctx,
    startedAt: new Date().toISOString(),
    evidenceRoot,
    testId: selected.map((s) => s.code).join('_'),
    suiteId,
    serviceMode,
  }
}

function logRunHeader(input: RunInputs, opts: CliOptions): void {
  console.log(`=== e2e-agent run ===`)
  console.log(`suite: ${input.suiteId}`)
  console.log(`scenarios: ${input.selected.map((s) => s.code).join(', ')}`)
  if (opts.evidence) {
    console.log(`evidence: ${input.evidenceRoot}\n`)
  }
}

export async function runE2e(argv: string[], opts: CliOptions): Promise<RunE2eOutcome> {
  const repoRoot = resolveRepoRoot(process.cwd())
  const projectConfig = loadProjectConfig(repoRoot, argv)
  const adapter = await loadProjectAdapter(repoRoot, projectConfig)
  const inputs = await prepareRunInputs({ argv, opts, repoRoot, adapter, projectConfig })

  logRunHeader(inputs, opts)

  const timeoutMs = Number(inputs.ctx.timeoutMs ?? 300_000)
  const results = await runSelectedScenarios({
    adapter,
    selected: inputs.selected,
    ctx: inputs.ctx,
    suiteId: inputs.suiteId,
    timeoutMs,
  })
  const exitCode = results.every((r) => r.passed) ? 0 : 1

  let evidencePath: string | undefined
  if (opts.evidence) {
    evidencePath = writeRunEvidence({
      evidenceRoot: inputs.evidenceRoot,
      testId: inputs.testId,
      exitCode,
      startedAt: inputs.startedAt,
      opts,
      ctx: inputs.ctx,
      selected: inputs.selected,
      results,
      serviceMode: inputs.serviceMode,
    })
  }

  return { exitCode, evidencePath }
}

export function listScenarios(
  argv: string[],
  suiteFilter?: string
): { repoRoot: string; projectConfig: ProjectE2eConfig } {
  const repoRoot = resolveRepoRoot(process.cwd())
  const projectConfig = loadProjectConfig(repoRoot, argv)
  if (suiteFilter) {
    const suiteId = resolveSuiteId(projectConfig, suiteFilter)
    const suite = projectConfig.suites[suiteId]!
    printCatalog(loadScenariosFromDir(suiteDir(repoRoot, suite)), suiteId)
    return { repoRoot, projectConfig }
  }
  for (const [suiteId, suite] of Object.entries(projectConfig.suites)) {
    printCatalog(loadScenariosFromDir(suiteDir(repoRoot, suite)), suiteId)
  }
  return { repoRoot, projectConfig }
}

export async function showScenarioByCode(argv: string[], code: string): Promise<void> {
  const repoRoot = resolveRepoRoot(process.cwd())
  const projectConfig = loadProjectConfig(repoRoot, argv)
  const suiteId = resolveSuiteId(projectConfig, code)
  const suite = projectConfig.suites[suiteId]!
  const scenarios = loadScenariosFromDir(suiteDir(repoRoot, suite))
  const scenario = filterScenarios(scenarios, code)[0]
  if (!scenario) throw new Error(`Scenario not found: ${code}`)
  showScenario(scenario)
}
