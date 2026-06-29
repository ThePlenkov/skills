import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import yaml from 'js-yaml'
import { getCliFlag } from './context'

export const DEFAULT_E2E_CONFIG = 'e2e.config.yaml'

export type SuiteEntry = {
  dir: string
  codePrefix: string
}

export type ProjectE2eConfig = {
  adapter: string
  suites: Record<string, SuiteEntry>
  specPath?: string
  autoclean?: boolean
}

export function resolveConfigPath(repoRoot: string, argv: string[]): string {
  const fromCli = getCliFlag(argv, '--config')
  const fromEnv = process.env.E2E_CONFIG?.trim()
  const rel = fromCli ?? fromEnv ?? DEFAULT_E2E_CONFIG
  const path = isAbsolute(rel) ? rel : join(repoRoot, rel)
  if (!existsSync(path)) {
    throw new Error(
      `Missing project config at ${path}. Pass --config <path>, set E2E_CONFIG, or add ${DEFAULT_E2E_CONFIG} at repo root.`
    )
  }
  return path
}

function validateProjectConfig(
  parsed: ProjectE2eConfig | null | undefined,
  path: string
): ProjectE2eConfig {
  if (!parsed?.adapter?.trim()) {
    throw new Error(`Project config ${path} requires adapter: <module-path>`)
  }
  if (!parsed.suites || Object.keys(parsed.suites).length === 0) {
    throw new Error(`Project config ${path} requires at least one suite under suites:`)
  }
  return parsed
}

export function loadProjectConfig(repoRoot: string, argv: string[]): ProjectE2eConfig {
  const path = resolveConfigPath(repoRoot, argv)
  if (!existsSync(path)) {
    throw new Error(`Project config not found: ${path}`)
  }
  const parsed = yaml.load(readFileSync(path, 'utf8')) as ProjectE2eConfig
  return validateProjectConfig(parsed, path)
}

export function resolveSuiteId(config: ProjectE2eConfig, input: string): string {
  const key = input.trim()
  if (key in config.suites) return key
  const lower = key.toLowerCase()
  for (const [id, suite] of Object.entries(config.suites)) {
    if (lower.startsWith(suite.codePrefix.toLowerCase())) return id
  }
  throw new Error(
    `Unknown suite or scenario "${input}". Use a suite id (${Object.keys(config.suites).join(', ')}) or scenario code.`
  )
}

export function suiteDir(repoRoot: string, suite: SuiteEntry): string {
  return join(repoRoot, suite.dir)
}

export function adapterModulePath(repoRoot: string, config: ProjectE2eConfig): string {
  const rel = config.adapter.trim()
  return isAbsolute(rel) ? rel : join(repoRoot, rel)
}
