import { describe, expect, test } from 'bun:test'
import { shouldHarvestAfterCiRun, workflowRunPrNumbers } from './resolve-harvest-target.ts'

describe('resolve-harvest-target', () => {
  test('workflowRunPrNumbers dedupes and ignores invalid', () => {
    expect(
      workflowRunPrNumbers([{ number: 42 }, { number: 42 }, { number: 0 }, {}, { number: 7 }])
    ).toEqual([42, 7])
  })

  test('shouldHarvestAfterCiRun requires pull_request and not cancelled', () => {
    expect(shouldHarvestAfterCiRun({ event: 'pull_request', conclusion: 'success' })).toBe(true)
    expect(shouldHarvestAfterCiRun({ event: 'pull_request', conclusion: 'failure' })).toBe(true)
    expect(shouldHarvestAfterCiRun({ event: 'pull_request', conclusion: 'cancelled' })).toBe(false)
    expect(shouldHarvestAfterCiRun({ event: 'push', conclusion: 'success' })).toBe(false)
  })

  test('workflowRunPrNumbers tolerates null and undefined', () => {
    expect(workflowRunPrNumbers(null)).toEqual([])
    expect(workflowRunPrNumbers(undefined)).toEqual([])
    expect(workflowRunPrNumbers([])).toEqual([])
  })
})
