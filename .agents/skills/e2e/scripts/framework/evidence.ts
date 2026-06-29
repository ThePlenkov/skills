import { randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  readFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { resolveE2eAgent, resolveE2eExecution, resolveE2eModel, type CliOptions } from './context'
import { substituteValue } from './template'
import type { AssertCheck, RunContext, Scenario, ScenarioResult } from './types'
import { load as yamlLoad } from 'js-yaml'
import { resolveConfigPath } from './project-config'

const NESTED_SKILL_PACKAGE = 'e2e-ai-testing-skill'

function isConsumingRepoRoot(dir: string): boolean {
  if (existsSync(join(dir, 'pom.xml'))) return true
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath)) return false
  try {
    const name = (JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string }).name
    return name !== NESTED_SKILL_PACKAGE
  } catch {
    return true
  }
}

export function resolveRepoRoot(start: string): string {
  if (process.env.E2E_REPO?.trim()) {
    return process.env.E2E_REPO.trim()
  }
  let dir = start
  for (let i = 0; i < 12; i++) {
    if (isConsumingRepoRoot(dir)) return dir
    const parent = join(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return start
}

export function defaultEvidenceRoot(repoRoot: string): string {
  return join(repoRoot, '.e2e', 'results')
}

/** Single-codepoint verdict markers — safe on Windows 10+, macOS, Linux (no ZWJ). */
export const EVIDENCE_PASS_MARK = '✅'
export const EVIDENCE_FAIL_MARK = '❌'

function evidenceTimestamp(at: Date | string): string {
  const date = typeof at === 'string' ? new Date(at) : at
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/:/g, '-')
}

function verdictMark(passed: boolean): string {
  return passed ? EVIDENCE_PASS_MARK : EVIDENCE_FAIL_MARK
}

/** `<iso-datetime>-<✅|❌>-<test_id>-<8hex>` */
export function evidenceFileBase(
  testId: string,
  passed: boolean,
  at: Date | string = new Date()
): string {
  const ts = evidenceTimestamp(at)
  const suffix = randomBytes(4).toString('hex')
  const safeId = testId.replace(/[^\w.-]+/g, '-')
  return `${ts}-${verdictMark(passed)}-${safeId}-${suffix}`
}

export function createEvidencePath(
  root: string,
  testId: string,
  passed: boolean,
  at: Date | string = new Date()
): { runId: string; path: string } {
  const runId = evidenceFileBase(testId, passed, at)
  mkdirSync(root, { recursive: true })
  return { runId, path: join(root, `${runId}.md`) }
}

type EvidenceReportInput = {
  path: string
  runId: string
  startedAt: string
  finishedAt: string
  exitCode: number
  opts: CliOptions
  ctx: RunContext
  scenarios: Scenario[]
  results: ScenarioResult[]
  serviceMode: string
}

function gwtText(raw: string, ctx: RunContext): string {
  return substituteValue(raw, ctx) as string
}

function verdictLabel(passed: boolean): string {
  return passed ? '✅ PASS' : '❌ FAIL'
}

function formatIsError(isError: boolean | undefined): string {
  if (isError === undefined) return '❓ unknown'
  return isError ? '❌ true' : '✅ false'
}

function formatChecksTable(checks: AssertCheck[]): string[] {
  return [
    '| Check | Expected | Actual | Result |',
    '| ----- | -------- | ------ | ------ |',
    ...checks.map((c) => `| ${c.name} | ${c.expected} | ${c.actual} | ${verdictLabel(c.passed)} |`),
  ]
}

function formatStepBlock(i: number, step: NonNullable<ScenarioResult['steps']>[number]): string[] {
  const lines: string[] = [
    `### 🔧 Step ${i + 1}: \`${step.tool}\``,
    '',
    `- **Duration:** ⏱️ ${step.durationMs ?? '?'}ms`,
    `- **isError:** ${formatIsError(step.isError)}`,
    `- **Args:** \`${JSON.stringify(step.args ?? {})}\``,
    '',
  ]
  if (step.checks?.length) {
    lines.push('#### ✅ Assertion checks', '', ...formatChecksTable(step.checks), '')
  }
  if (step.responseBody) {
    lines.push('#### 📦 Response payload', '', '```text', step.responseBody, '```', '')
  }
  lines.push(`**Step verdict:** ${verdictLabel(step.ok)} — ${step.detail}`, '')
  return lines
}

function formatScenarioBlock(
  scenario: Scenario,
  result: ScenarioResult | undefined,
  ctx: RunContext
): string[] {
  const passed = result?.passed ?? false
  const lines = [
    `## 🧪 ${scenario.code} — ${scenario.title}`,
    '',
    `**Scenario verdict:** ${verdictLabel(passed)}`,
    '',
    '### 🟢 Given',
    '',
    gwtText(scenario.given, ctx),
    '',
    '### ⚡ When',
    '',
    gwtText(scenario.when, ctx),
    '',
    '### 🎯 Then (expected)',
    '',
    gwtText(scenario.then, ctx),
    '',
  ]

  for (const [i, step] of (result?.steps ?? []).entries()) {
    lines.push(...formatStepBlock(i, step))
  }

  return lines
}

function buildEvidenceMarkdown(input: EvidenceReportInput): string {
  const { scenarios, results, ctx, runId, exitCode } = input
  const passed = results.filter((r) => r.passed).length
  const durationMs = new Date(input.finishedAt).getTime() - new Date(input.startedAt).getTime()

  const allPassed = exitCode === 0
  const agent = resolveE2eAgent(input.opts)
  const model = resolveE2eModel(input.opts)
  const lines = [
    `# 📋 E2E evidence — ${scenarios.map((s) => `${s.code}: ${s.title}`).join(', ')}`,
    '',
    `**Verdict:** ${verdictLabel(allPassed)}`,
    `**Run id:** 🆔 ${runId}`,
    `**Started:** 🕐 ${input.startedAt}`,
    `**Finished:** 🕑 ${input.finishedAt}`,
    `**Duration:** ⏱️ ${durationMs}ms`,
    `**Scenarios:** ${allPassed ? '✅' : '⚠️'} ${passed}/${results.length} passed`,
    '',
    '## 🚀 How this run was executed',
    '',
    `- **Agent:** ${agent}`,
    `- **Model / LLM:** ${model}`,
    `- **Execution:** ${resolveE2eExecution(agent)}`,
    ...(ctx.destination ? [`- **Destination:** ${formatDestination(ctx.destination)}`] : []),
    `- **Scenario files:** ${scenarios.map((s) => s.file).join(', ')}`,
    '',
    '---',
    '',
  ]

  for (const scenario of scenarios) {
    const result = results.find((r) => r.code === scenario.code)
    lines.push(...formatScenarioBlock(scenario, result, ctx), '---', '')
  }

  lines.push(
    '## 🏁 Overall verdict',
    '',
    allPassed
      ? `✅ PASS — all Then criteria met (${passed}/${results.length} scenarios).`
      : `❌ FAIL — ${results.length - passed} scenario(s) did not meet Then criteria.`,
    ''
  )

  return lines.join('\n')
}

export function writeEvidenceReport(input: EvidenceReportInput): void {
  writeFileSync(input.path, buildEvidenceMarkdown(input))
}

/** Delete ALL old evidence files for a given scenario code before writing new evidence. */
export function autocleanOldEvidence(root: string, scenarioCode: string): void {
  if (!existsSync(root)) return

  const files = readdirSync(root).filter(
    (f) => f.endsWith('.md') && f.includes(`-${scenarioCode}-`)
  )

  // Delete all matching files (we're about to write a new one)
  for (const file of files) {
    try {
      unlinkSync(join(root, file))
    } catch {
      // Ignore deletion errors (file might be locked by another process)
    }
  }
}

export function shouldRedactDestination(): boolean {
  return process.env.E2E_REDACT === '1'
}

export function formatDestination(destination: string): string {
  if (shouldRedactDestination()) return '<destination>'
  return destination
}

export type E2eAgentConfig = {
  autoclean?: boolean
}

/** Read runner options from e2e.config.yaml and TESTING.md frontmatter. */
export function readE2eAgentConfig(repoRoot: string, argv: string[] = []): E2eAgentConfig {
  const config: E2eAgentConfig = {}

  try {
    const yamlConfigPath = resolveConfigPath(repoRoot, argv)
    const yamlContent = readFileSync(yamlConfigPath, 'utf-8')
    const parsed = yamlLoad(yamlContent) as E2eAgentConfig
    if (parsed.autoclean !== undefined) config.autoclean = parsed.autoclean
  } catch {
    // No project config — fall through to TESTING.md frontmatter
  }

  // Try TESTING.md frontmatter
  const testingMdPath = join(repoRoot, 'TESTING.md')
  if (existsSync(testingMdPath)) {
    try {
      const content = readFileSync(testingMdPath, 'utf-8')
      const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/)
      if (frontmatterMatch) {
        const frontmatter = yamlLoad(frontmatterMatch[1]!) as { 'e2e-agent'?: E2eAgentConfig }
        if (frontmatter['e2e-agent']) {
          Object.assign(config, frontmatter['e2e-agent'])
        }
      }
    } catch {
      // Ignore frontmatter parse errors
    }
  }

  return config
}

export type E2eSuiteMeta = {
  scenarioFilePrefix: string
  formatCommand: (scenarios: Scenario[], ctx: RunContext) => string
}

/** Default suite meta - implementations should provide their own */
export const DEFAULT_E2E_SUITE: E2eSuiteMeta = {
  scenarioFilePrefix: 'e2e/scenarios/',
  formatCommand: (scenarios: Scenario[], ctx: RunContext) => {
    const codes = scenarios.map((s) => s.code).join(' ')
    const args = Object.entries(ctx)
      .filter(([k]) => k !== 'prompt')
      .map(([k, v]) => `--${k} ${v}`)
      .join(' ')
    return args ? `<runner> -- ${codes} ${args}` : `<runner> -- ${codes}`
  },
}
