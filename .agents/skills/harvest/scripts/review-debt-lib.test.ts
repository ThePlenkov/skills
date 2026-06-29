import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildSummary,
  harvestFilename,
  readDebtRecords,
  upsertLedgerOverlays,
  writeHarvestFile,
  upsertRecords,
  type DebtRecord,
} from './review-debt-lib.ts'
import { bodyPreview, deriveArea, fingerprint, normalizeBody } from './review-debt-text.ts'

function sampleDebtRecord(overrides: Partial<DebtRecord> = {}): DebtRecord {
  return {
    thread_id: 'PRRT_1',
    thread_url: 'https://example.com#1',
    status: 'open',
    priority: 'nit',
    needs: 'code_change',
    source_pr: 1,
    source_pr_url: 'https://example.com/pull/1',
    source_pr_title: 't',
    merged_at: '2026-01-01T00:00:00Z',
    merged_sha: 'abc',
    path: 'a/b',
    line: 1,
    author: 'bot',
    body: 'fix',
    body_preview: 'fix',
    fingerprint: 'sha256:1',
    area: 'a',
    harvested_at: '2026-01-01T00:00:00Z',
    harvest_run_id: 'r1',
    times_seen: 1,
    fix_pr: null,
    fixed_at: null,
    notes: null,
    ...overrides,
  }
}

describe('review-debt-lib', () => {
  test('fingerprint is stable for normalized body', () => {
    const path = 'apps/foo/Bar.java'
    const a = fingerprint({ body: 'Consider  extracting', path })
    const b = fingerprint({ body: 'consider extracting', path })
    expect(a).toBe(b)
  })

  test('deriveArea uses first two segments', () => {
    expect(deriveArea('apps/openadt-cli/src/Foo.java')).toBe('apps/openadt-cli')
    expect(deriveArea('README.md')).toBe('README.md')
  })

  test('bodyPreview truncates long text', () => {
    const long = 'x'.repeat(200)
    expect(bodyPreview(long).length).toBeLessThanOrEqual(120)
  })

  test('normalizeBody collapses whitespace', () => {
    expect(normalizeBody('  Hello   World  ')).toBe('hello world')
  })

  test('upsertRecords increments times_seen', () => {
    const base = sampleDebtRecord()
    const incoming = { ...base, harvested_at: '2026-02-01T00:00:00Z' }
    const merged = upsertRecords([base], [incoming])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.times_seen).toBe(2)
  })

  test('upsertRecords reopens done rows on re-harvest', () => {
    const done = sampleDebtRecord({
      status: 'done',
      fix_pr: 99,
      fixed_at: '2026-02-01T00:00:00Z',
    })
    const incoming = {
      ...done,
      status: 'open' as const,
      harvested_at: '2026-03-01T00:00:00Z',
      harvest_run_id: 'r2',
    }
    const merged = upsertRecords([done], [incoming])
    expect(merged[0]?.status).toBe('open')
    expect(merged[0]?.fix_pr).toBeNull()
    expect(merged[0]?.times_seen).toBe(2)
  })

  test('buildSummary handles zero open rows', () => {
    const summary = buildSummary([])
    expect(summary.open_count).toBe(0)
    expect(summary.oldest_open).toBeNull()
  })
})

describe('review-debt harvest files', () => {
  test('harvestFilename includes timestamp pr and run', () => {
    expect(
      harvestFilename({
        harvestedAt: '2026-06-09T15:46:45.123Z',
        pr: 82,
        runId: '27218119809',
      })
    ).toBe('2026-06-09T154645Z-pr-82-run-27218119809.jsonl')
  })

  test('readDebtRecords merges harvest files and ledger overlay', () => {
    const dir = mkdtempSync(join(tmpdir(), 'debt-harvest-'))
    const prevDir = process.env.OPENADT_DEBT_DIR
    process.env.OPENADT_DEBT_DIR = dir
    try {
      const row = sampleDebtRecord()
      writeHarvestFile({
        pr: 1,
        runId: 'run1',
        harvestedAt: '2026-01-01T00:00:00Z',
        records: [row],
      })
      upsertLedgerOverlays([
        {
          thread_id: 'PRRT_1',
          status: 'done',
          fix_pr: 99,
          fixed_at: '2026-02-01T00:00:00Z',
          notes: null,
        },
      ])
      const merged = readDebtRecords()
      expect(merged).toHaveLength(1)
      expect(merged[0]?.status).toBe('done')
      expect(merged[0]?.fix_pr).toBe(99)
    } finally {
      if (prevDir === undefined) {
        delete process.env.OPENADT_DEBT_DIR
      } else {
        process.env.OPENADT_DEBT_DIR = prevDir
      }
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
