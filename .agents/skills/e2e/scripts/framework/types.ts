export type ScenarioMode = 'standalone' | 'shared'

export type ScenarioAssert = {
  contentContains?: string | string[]
  notError?: boolean
  success?: boolean
  minCount?: number
  destinationsInclude?: string
}

export type ScenarioStep = {
  tool: string
  args?: Record<string, unknown>
  assert?: ScenarioAssert
}

/** Stable operator id, e.g. `test-1`, `suite-2`. */
export type ScenarioCode = string

export type Scenario = {
  code: ScenarioCode
  id: string
  /** Basename under `scenarios/`, e.g. `test-1-list-items.md`. */
  file: string
  title: string
  tags?: string[]
  mode?: ScenarioMode
  /** TDD — required in scenario frontmatter. */
  given: string
  when: string
  then: string
  intent: string
  steps: ScenarioStep[]
}

export type RunContext = {
  prompt?: string
  [key: string]: unknown
}

export type AssertCheck = {
  name: string
  expected: string
  actual: string
  passed: boolean
}

export type StepResult = {
  tool: string
  ok: boolean
  detail: string
  durationMs?: number
  args?: Record<string, unknown>
  isError?: boolean
  checks?: AssertCheck[]
  responseBody?: string
}

export type ScenarioResult = {
  code: ScenarioCode
  id: string
  title: string
  passed: boolean
  steps: StepResult[]
}
