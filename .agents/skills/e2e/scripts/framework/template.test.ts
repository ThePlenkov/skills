import { describe, expect, test } from 'bun:test'
import { substituteArgs, substituteAssert } from './template'
import type { RunContext } from './types'

const ctx: RunContext = {
  destination: 'ABC_200_USER_EN',
  pattern: 'CL_ABAP*',
  importFrom: 'adtls',
  port: 2239,
  timeoutMs: 300_000,
}

describe('template', () => {
  test('substitutes destination in nested args', () => {
    const out = substituteArgs(
      { destination: '{{destination}}', nested: { pattern: '{{pattern}}' } },
      ctx
    )
    expect(out.destination).toBe('ABC_200_USER_EN')
    expect((out.nested as { pattern: string }).pattern).toBe('CL_ABAP*')
  })

  test('substitutes destination in assert block', () => {
    const out = substituteAssert({ destinationsInclude: '{{destination}}' }, ctx)
    expect(out?.destinationsInclude).toBe('ABC_200_USER_EN')
  })
})
