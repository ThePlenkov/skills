import type { AssertCheck, ScenarioAssert } from './types'

export type ToolCallPayload = {
  contentText: string
  isError: boolean
  structured?: unknown
}

export type AssertVerdict = {
  ok: boolean
  detail: string
  checks: AssertCheck[]
}

export function extractToolPayload(result: unknown): ToolCallPayload {
  const r = result as {
    isError?: boolean
    content?: Array<{ type?: string; text?: string }>
    structuredContent?: unknown
  }
  const parts = (r.content ?? []).filter((c) => c.type === 'text' && c.text).map((c) => c.text!)
  return {
    contentText: parts.join('\n'),
    isError: r.isError === true,
    structured: r.structuredContent ?? tryParseJson(parts[0]),
  }
}

function tryParseJson(text: string | undefined): unknown {
  if (!text?.trim().startsWith('{')) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function collectChecksForAssert(
  assert: ScenarioAssert | undefined,
  payload: ToolCallPayload
): AssertCheck[] {
  const checks: AssertCheck[] = [isErrorCheck(assert, payload)]
  if (!assert) return checks
  if (assert.notError) checks.push(agentFailureCheck(payload))
  if (assert.success) checks.push(successEnvelopeCheck(payload))
  if (assert.contentContains) {
    checks.push(...contentContainsChecks(assert.contentContains, payload))
  }
  if (assert.destinationsInclude) {
    checks.push(destinationsIncludeCheck(assert.destinationsInclude, payload))
  }
  if (assert.minCount !== undefined) checks.push(minCountCheck(assert.minCount, payload))
  return checks
}

function buildVerdictFromChecks(checks: AssertCheck[]): AssertVerdict {
  const failed = checks.filter((c) => !c.passed)
  if (failed.length === 0) return { ok: true, detail: summarizePass(checks), checks }
  return {
    ok: false,
    detail: failed.map((c) => `${c.name}: expected ${c.expected}, got ${c.actual}`).join('; '),
    checks,
  }
}

export function evaluateAssert(
  assert: ScenarioAssert | undefined,
  payload: ToolCallPayload
): AssertVerdict {
  return buildVerdictFromChecks(collectChecksForAssert(assert, payload))
}

function isErrorCheck(assert: ScenarioAssert | undefined, payload: ToolCallPayload): AssertCheck {
  const enforced = assert?.notError === true || assert?.success === true
  return {
    name: 'service_is_error',
    expected: enforced ? 'isError=false' : '(informational)',
    actual: `isError=${payload.isError}`,
    passed: !enforced || !payload.isError,
  }
}

function agentFailureCheck(payload: ToolCallPayload): AssertCheck {
  const failed = hasAgentFailure(payload.contentText)
  return {
    name: 'agent_success_envelope',
    expected: 'no "success":false in response',
    actual: failed ? 'found "success":false' : 'no agent failure marker',
    passed: !failed,
  }
}

function successEnvelopeCheck(payload: ToolCallPayload): AssertCheck {
  const ok = agentSuccess(payload.contentText)
  return {
    name: 'agent_success_true',
    expected: '"success":true in response',
    actual: ok ? '"success":true present' : 'success:true not found',
    passed: ok,
  }
}

function contentContainsChecks(rule: string | string[], payload: ToolCallPayload): AssertCheck[] {
  const needles = Array.isArray(rule) ? rule : [rule]
  return needles.map((needle) => ({
    name: `content_contains:${needle}`,
    expected: `response includes "${needle}"`,
    actual: payload.contentText.includes(needle) ? `found "${needle}"` : `missing "${needle}"`,
    passed: payload.contentText.includes(needle),
  }))
}

function destinationsIncludeCheck(destination: string, payload: ToolCallPayload): AssertCheck {
  const found = payload.contentText.includes(destination)
  return {
    name: 'destinations_include',
    expected: `destination list includes "${destination}"`,
    actual: found ? `found "${destination}" in response` : `"${destination}" not in response text`,
    passed: found,
  }
}

function minCountCheck(min: number, payload: ToolCallPayload): AssertCheck {
  const count = arrayLength(payload.structured)
  return {
    name: 'min_count',
    expected: `at least ${min} item(s) in results/references`,
    actual: `${count} item(s)`,
    passed: count >= min,
  }
}

function summarizePass(checks: AssertCheck[]): string {
  const names = checks.filter((c) => c.passed).map((c) => c.name)
  return `passed: ${names.join(', ')}`
}

function hasAgentFailure(text: string): boolean {
  return /"success"\s*:\s*false/.test(text)
}

function agentSuccess(text: string): boolean {
  return /"success"\s*:\s*true/.test(text)
}

const ARRAY_KEYS = ['references', 'results'] as const

function pickArrayLength(value: Record<string, unknown>): number | undefined {
  for (const key of ARRAY_KEYS) {
    const v = value[key]
    if (Array.isArray(v)) return v.length
  }
  return undefined
}

function isStructuredObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function lengthFromNestedArray(data: unknown): number | undefined {
  if (Array.isArray(data)) return data.length
  if (!isStructuredObject(data)) return undefined
  return pickArrayLength(data)
}

function arrayLength(structured: unknown): number {
  if (Array.isArray(structured)) return structured.length
  if (!isStructuredObject(structured)) return 0
  return topLevelArrayLength(structured) ?? nestedDataArrayLength(structured.data)
}

function topLevelArrayLength(o: Record<string, unknown>): number | undefined {
  return pickArrayLength(o)
}

function nestedDataArrayLength(data: unknown): number {
  return lengthFromNestedArray(data) ?? 0
}
