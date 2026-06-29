import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DebtRecord } from '../../harvest/scripts/review-debt-lib.ts'

function sampleOpenRecord(): DebtRecord {
  return {
    thread_id: 'PRRT_test',
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
  }
}

describe('update-debt-status', () => {
  test('marks ledger rows done with fix PR', () => {
    const dir = mkdtempSync(join(tmpdir(), 'debt-test-'))
    const harvestDir = join(dir, 'harvests')
    const summaryPath = join(dir, 'summary.json')
    mkdirSync(harvestDir, { recursive: true })
    writeFileSync(
      join(harvestDir, '2026-01-01T000000Z-pr-1-run-test.jsonl'),
      `${JSON.stringify(sampleOpenRecord())}\n`,
      'utf8'
    )

    const proc = Bun.spawnSync(
      [
        'bun',
        join(import.meta.dir, 'update-debt-status.ts'),
        '--thread-id',
        'PRRT_test',
        '--status',
        'done',
        '--fix-pr',
        '99',
      ],
      {
        cwd: join(import.meta.dir, '../../../..'),
        env: {
          ...process.env,
          OPENADT_DEBT_DIR: dir,
          OPENADT_DEBT_SUMMARY: summaryPath,
        },
      }
    )
    expect(proc.exitCode).toBe(0)
    const ledger = JSON.parse(readFileSync(join(dir, 'ledger.jsonl'), 'utf8').trim()) as {
      status: string
      fix_pr: number
    }
    expect(ledger.status).toBe('done')
    expect(ledger.fix_pr).toBe(99)
    rmSync(dir, { recursive: true, force: true })
  })
})
