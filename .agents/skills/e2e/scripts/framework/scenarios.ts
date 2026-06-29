import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'
import type { Scenario, ScenarioCode, ScenarioStep } from './types'

export function scenariosDir(root: string): string {
  return root
}

type Frontmatter = {
  code?: string
  id?: string
  title?: string
  tags?: string[]
  mode?: Scenario['mode']
  given?: string
  when?: string
  then?: string
  steps?: ScenarioStep[]
}

/**
 * Generic scenario code pattern - implementations can override.
 * Default: expects codes like "test-1", "test-2", etc.
 */
const DEFAULT_CODE_RE = /^[\w-]+-\d+$/
const DEFAULT_FILE_RE = /^[\w-]+-\d+-[\w-]+\.md$/

/** Expected basename: `<prefix>-N-<id>.md` (sorted by N, readable slug from frontmatter `id`). */
export function expectedScenarioFilename(code: ScenarioCode, id: string): string {
  return `${code}-${id}.md`
}

export function normalizeScenarioCode(raw: string): ScenarioCode {
  const code = raw.trim().toLowerCase()
  if (!DEFAULT_CODE_RE.test(code)) {
    throw new Error(`Invalid scenario code "${raw}" (expected format: prefix-number, e.g., test-1)`)
  }
  return code as ScenarioCode
}

/** Split YAML frontmatter and markdown body (`---` … `---`). */
export function parseScenarioMarkdown(raw: string): {
  meta: Frontmatter
  body: string
} {
  const trimmed = raw.replace(/^\uFEFF/, '').trimStart()
  if (!trimmed.startsWith('---')) {
    throw new Error('Scenario .md must start with YAML frontmatter (---)')
  }
  const end = trimmed.indexOf('\n---', 3)
  if (end < 0) {
    throw new Error('Scenario .md frontmatter not closed with ---')
  }
  const yamlBlock = trimmed.slice(3, end).trim()
  const body = trimmed.slice(end + 4).trim()
  const meta = yaml.load(yamlBlock) as Frontmatter
  return { meta, body }
}

const GWT_KEYS = ['given', 'when', 'then'] as const

function assertCodePresent(file: string, meta: Frontmatter): void {
  if (!meta.code) {
    throw new Error(`Invalid scenario file: ${file} (missing code: prefix-number format)`)
  }
}

function assertIdAndStepsPresent(file: string, meta: Frontmatter): void {
  if (!meta.id || !meta.steps?.length) {
    throw new Error(`Invalid scenario file: ${file} (need id + steps in frontmatter)`)
  }
}

function assertBodyPresent(file: string, body: string): void {
  if (!body) {
    throw new Error(`Invalid scenario file: ${file} (markdown body required for agent brief)`)
  }
}

function assertGwtFrontmatter(file: string, meta: Frontmatter): void {
  for (const key of GWT_KEYS) {
    if (!meta[key]?.trim()) {
      throw new Error(`Invalid scenario file: ${file} (frontmatter requires ${key})`)
    }
  }
}

function assertRequiredFrontmatter(file: string, meta: Frontmatter, body: string): void {
  assertCodePresent(file, meta)
  assertIdAndStepsPresent(file, meta)
  assertBodyPresent(file, body)
  assertGwtFrontmatter(file, meta)
}

function assertScenarioFilename(file: string, code: string, id: string): void {
  if (!DEFAULT_FILE_RE.test(file)) {
    throw new Error(`Invalid scenario file: ${file} (filename must match prefix-N-<id>.md)`)
  }
  const expected = expectedScenarioFilename(code, id)
  if (file !== expected) {
    throw new Error(
      `Invalid scenario file: ${file} (expected ${expected} for code=${code}, id=${id})`
    )
  }
}

export function toScenario(file: string, meta: Frontmatter, body: string): Scenario {
  assertRequiredFrontmatter(file, meta, body)
  const code = normalizeScenarioCode(meta.code)
  assertScenarioFilename(file, code, meta.id)
  return {
    code,
    id: meta.id,
    file,
    title: meta.title ?? meta.id,
    tags: meta.tags,
    mode: meta.mode,
    given: meta.given!.trim(),
    when: meta.when!.trim(),
    then: meta.then!.trim(),
    intent: body,
    steps: meta.steps,
  }
}

function assertUniqueCodes(scenarios: Scenario[]): void {
  const seen = new Map<string, string>()
  for (const s of scenarios) {
    const prev = seen.get(s.code)
    if (prev) {
      throw new Error(`Duplicate scenario code ${s.code}: ${prev} and ${s.id}`)
    }
    seen.set(s.code, s.id)
  }
}

export function loadScenariosFromDir(dir: string): Scenario[] {
  if (!existsSync(dir)) return []
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
  const out: Scenario[] = []
  for (const file of files.sort()) {
    const raw = readFileSync(join(dir, file), 'utf8')
    const { meta, body } = parseScenarioMarkdown(raw)
    out.push(toScenario(file, meta, body))
  }
  assertUniqueCodes(out)
  return out.sort((a, b) => a.code.localeCompare(b.code))
}

function scenarioFileMatchesSelector(file: string, selector: string): boolean {
  const key = selector.trim().toLowerCase()
  const lower = file.toLowerCase()
  if (lower.startsWith(`${key}-`)) return true
  return lower.includes(`-${key}-`) || lower.includes(`-${key}.`)
}

/** Load scenarios from `<root>/scenarios/` only — optional filename pre-filter (avoids bulk YAML parse failures). */
function collectScenarioFiles(root: string, selector?: string): string[] {
  const dir = scenariosDir(root)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !selector?.trim() || scenarioFileMatchesSelector(f, selector))
    .sort()
}

function parseScenarioFile(dir: string, file: string): Scenario {
  const raw = readFileSync(join(dir, file), 'utf8')
  const { meta, body } = parseScenarioMarkdown(raw)
  return toScenario(file, meta, body)
}

function handleScenarioError(file: string, err: unknown, skipInvalid: boolean | undefined): void {
  if (!skipInvalid) throw err
  const message = err instanceof Error ? err.message : String(err)
  console.warn(`Skipping scenario file ${file}: ${message}`)
}

function appendScenario(
  out: Scenario[],
  dir: string,
  file: string,
  skipInvalid: boolean | undefined
): void {
  try {
    out.push(parseScenarioFile(dir, file))
  } catch (err) {
    handleScenarioError(file, err, skipInvalid)
  }
}

export function loadScenariosFromRoot(
  root: string,
  selector?: string,
  options?: { skipInvalid?: boolean }
): Scenario[] {
  const dir = scenariosDir(root)
  const files = collectScenarioFiles(root, selector)
  const out: Scenario[] = []
  for (const file of files) {
    appendScenario(out, dir, file, options?.skipInvalid)
  }
  assertUniqueCodes(out)
  return out.sort((a, b) => a.code.localeCompare(b.code))
}

/** Match by stable code or slug id. */
export function filterScenarios(all: Scenario[], selector: string | undefined): Scenario[] {
  if (!selector) return all
  const key = selector.trim().toLowerCase()
  const hit = all.filter((s) => scenarioMatchesSelector(s, key))
  if (hit.length === 0) {
    throw new Error(
      `Unknown scenario: ${selector} (use scenario code or slug id; check scenario list)`
    )
  }
  return hit
}

function scenarioMatchesSelector(s: Scenario, key: string): boolean {
  if (s.id.toLowerCase() === key) return true
  if (s.code === key) return true
  if (!DEFAULT_CODE_RE.test(key)) return false
  return s.code === normalizeScenarioCode(key)
}

export function findScenarioByCode(all: Scenario[], code: string): Scenario | undefined {
  try {
    const normalized = normalizeScenarioCode(code)
    return all.find((s) => s.code === normalized)
  } catch {
    return undefined
  }
}
