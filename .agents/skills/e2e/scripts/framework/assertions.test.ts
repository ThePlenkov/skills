import { describe, expect, test } from 'bun:test'
import { evaluateAssert, extractToolPayload } from './assertions'

describe('assertions', () => {
  test('contentContains passes on substring', () => {
    const p = extractToolPayload({
      content: [{ type: 'text', text: 'class CL_ABAP_TYPEDESCR' }],
    })
    const r = evaluateAssert({ contentContains: 'CL_ABAP_TYPEDESCR' }, p)
    expect(r.ok).toBe(true)
    expect(r.checks.some((c) => c.name.startsWith('content_contains'))).toBe(true)
  })

  test('notError fails on agent success:false', () => {
    const p = extractToolPayload({
      content: [{ type: 'text', text: '{"success":false,"error":{}}' }],
    })
    const r = evaluateAssert({ notError: true }, p)
    expect(r.ok).toBe(false)
  })

  test('minCount on references array', () => {
    const p = extractToolPayload({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ references: [{ name: 'A' }, { name: 'B' }] }),
        },
      ],
    })
    const r = evaluateAssert({ minCount: 2 }, p)
    expect(r.ok).toBe(true)
  })
})
