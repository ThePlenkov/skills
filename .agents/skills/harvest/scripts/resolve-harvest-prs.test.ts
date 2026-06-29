import { describe, expect, test } from 'bun:test'
import {
  applyLastN,
  filterByMergedDate,
  filterByLabels,
  parseCsvInts,
  parseCsvStrings,
} from './resolve-harvest-prs.ts'
import type { MergedPrCandidate } from './resolve-harvest-prs.ts'

const sample: MergedPrCandidate[] = [
  {
    number: 1,
    mergedAt: '2026-06-08T12:00:00Z',
    author: 'alice',
    labels: ['enhancement'],
  },
  {
    number: 2,
    mergedAt: '2026-06-09T12:00:00Z',
    author: 'bob',
    labels: ['bug', 'priority'],
  },
  {
    number: 3,
    mergedAt: '2026-06-10T12:00:00Z',
    author: 'bob',
    labels: ['bug'],
  },
]

describe('resolve-harvest-prs', () => {
  test('parseCsvInts dedupes', () => {
    expect(parseCsvInts('72, 67,72')).toEqual([72, 67])
  })

  test('parseCsvStrings trims', () => {
    expect(parseCsvStrings(' foo, bar ')).toEqual(['foo', 'bar'])
  })

  test('filterByMergedDate inclusive range', () => {
    const rows = filterByMergedDate(sample, '2026-06-09', '2026-06-09')
    expect(rows.map((r) => r.number)).toEqual([2])
  })

  test('filterByLabels requires all labels', () => {
    const rows = filterByLabels(sample, ['bug', 'priority'])
    expect(rows.map((r) => r.number)).toEqual([2])
  })

  test('applyLastN keeps newest', () => {
    const rows = applyLastN(sample, 2)
    expect(rows.map((r) => r.number)).toEqual([3, 2])
  })
})
