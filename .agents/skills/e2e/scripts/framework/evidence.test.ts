import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_E2E_AGENT,
  DEFAULT_E2E_MODEL,
  resolveE2eAgent,
  resolveE2eExecution,
  resolveE2eModel,
} from './context'
import {
  createEvidencePath,
  EVIDENCE_FAIL_MARK,
  EVIDENCE_PASS_MARK,
  evidenceFileBase,
  formatDestination,
  resolveRepoRoot,
  writeEvidenceReport,
} from './evidence'
import type { ScenarioResult } from './types'

const frameworkDir = dirname(fileURLToPath(import.meta.url))

// eslint-disable-next-line max-lines-per-function -- describe block groups related evidence scenarios
describe('evidence', () => {
  test('resolveRepoRoot finds consuming repo root (skips nested skill package)', () => {
    const root = resolveRepoRoot(frameworkDir)
    expect(root).toMatch(/openadt$/i)
    expect(root).not.toMatch(/sap-adt-mcp-launcher$/)
  })

  test('evidenceFileBase includes verdict emoji in filename stem', () => {
    const pass = evidenceFileBase('mcp-1', true, new Date('2026-06-10T13:45:00.000Z'))
    expect(pass).toMatch(
      new RegExp(`^2026-06-10T13-45-00Z-${EVIDENCE_PASS_MARK}-mcp-1-[0-9a-f]{8}$`)
    )
    const fail = evidenceFileBase('mcp-1', false, new Date('2026-06-10T13:45:00.000Z'))
    expect(fail).toContain(`-${EVIDENCE_FAIL_MARK}-mcp-1-`)
  })

  test('createEvidencePath uses single .md file with emoji', () => {
    const root = mkdtempSync(join(tmpdir(), 'openadt-e2e-'))
    try {
      const { runId, path } = createEvidencePath(root, 'mcp-1', true)
      expect(path).toBe(join(root, `${runId}.md`))
      expect(runId).toContain(EVIDENCE_PASS_MARK)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  function buildGivenWhenThenReportInput(root: string, results: ScenarioResult[]) {
    const { runId, path } = createEvidencePath(root, 'mcp-1', true)
    return {
      path,
      runId,
      startedAt: '2026-06-10T13:00:00.000Z',
      finishedAt: '2026-06-10T13:00:01.000Z',
      exitCode: 0,
      opts: {
        evidence: true,
        list: false,
        executor: 'local',
        args: {},
      },
      ctx: {
        destination: 'ABC_200_USER_EN',
        pattern: 'CL_ABAP*',
        importFrom: 'adtls',
        port: 2239,
        timeoutMs: 300_000,
      },
      scenarios: [
        {
          code: 'mcp-1',
          id: 'list-destinations',
          file: 'mcp-1-list-destinations.md',
          title: 'List',
          given: 'destination {{destination}} is ready',
          when: 'call abap_list_destinations',
          then: 'response includes {{destination}}',
          intent: '# test',
          steps: [{ tool: 'abap_list_destinations' }],
        },
      ],
      results,
      serviceMode: 'test-suite',
    }
  }

  function assertGivenWhenThenInReport(md: string): void {
    expect(md).toContain('**Verdict:** ✅ PASS')
    expect(md).toContain('### 🟢 Given')
    expect(md).toContain('### ⚡ When')
    expect(md).toContain('### 🎯 Then (expected)')
    expect(md).toContain('destinations_include')
    expect(md).toContain('📦 Response payload')
    expect(md).toContain('**Destination:** ABC_200_USER_EN')
    expect(md).toContain('mcp-1-list-destinations.md')
    expect(md).toContain(`**Agent:** ${DEFAULT_E2E_AGENT}`)
    expect(md).toContain(`**Model / LLM:** ${DEFAULT_E2E_MODEL}`)
    expect(md).toContain('**Execution:** framework')
  }

  test('writeEvidenceReport writes Given/When/Then evidence', () => {
    const root = mkdtempSync(join(tmpdir(), 'openadt-e2e-'))
    try {
      const results: ScenarioResult[] = [
        {
          code: 'mcp-1',
          id: 'list-destinations',
          title: 'List',
          passed: true,
          steps: [
            {
              tool: 'abap_list_destinations',
              ok: true,
              detail: 'passed: mcp_replied, destinations_include',
              durationMs: 12,
              mcpReplied: true,
              isError: false,
              checks: [
                {
                  name: 'destinations_include',
                  expected: 'destination list includes "ABC_200_USER_EN"',
                  actual: 'found "ABC_200_USER_EN" in response',
                  passed: true,
                },
              ],
              responseBody: '{"destinations":["ABC_200_USER_EN"]}',
            },
          ],
        },
      ]
      const input = buildGivenWhenThenReportInput(root, results)
      writeEvidenceReport(input)
      const md = readFileSync(input.path, 'utf8')
      assertGivenWhenThenInReport(md)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('writeEvidenceReport records agent-orchestrated execution metadata', () => {
    const root = mkdtempSync(join(tmpdir(), 'openadt-e2e-'))
    try {
      const { runId, path } = createEvidencePath(root, 'mcp-1', true)
      writeEvidenceReport({
        path,
        runId,
        startedAt: '2026-06-10T13:00:00.000Z',
        finishedAt: '2026-06-10T13:00:01.000Z',
        exitCode: 0,
        opts: {
          evidence: true,
          list: false,
          executor: 'local',
          args: {},
          agent: 'cursor',
          model: 'Auto',
        },
        ctx: {
          destination: 'ABC_200_USER_EN',
          pattern: 'CL_ABAP*',
          importFrom: 'adtls',
          port: 2239,
          timeoutMs: 300_000,
        },
        scenarios: [
          {
            code: 'mcp-1',
            id: 'list-destinations',
            file: 'mcp-1-list-destinations.md',
            title: 'List',
            given: 'ready',
            when: 'call',
            then: 'ok',
            intent: '# test',
            steps: [{ tool: 'abap_list_destinations' }],
          },
        ],
        results: [
          {
            code: 'mcp-1',
            id: 'list-destinations',
            title: 'List',
            passed: true,
            steps: [],
          },
        ],
        serviceMode: 'test-suite',
      })
      const md = readFileSync(path, 'utf8')
      expect(md).toContain('**Agent:** cursor')
      expect(md).toContain('**Model / LLM:** Auto')
      expect(md).toContain('**Execution:** agent-orchestrated')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('resolveE2eAgent and resolveE2eModel apply defaults and trim', () => {
    const base = {
      list: false,
      evidence: false,
      executor: 'local' as const,
      args: {},
    }
    expect(resolveE2eAgent(base)).toBe(DEFAULT_E2E_AGENT)
    expect(resolveE2eModel(base)).toBe(DEFAULT_E2E_MODEL)
    expect(resolveE2eExecution(DEFAULT_E2E_AGENT)).toContain('framework')
    expect(resolveE2eExecution('cursor')).toContain('agent-orchestrated')
    expect(resolveE2eAgent({ ...base, agent: '  cursor  ' })).toBe('cursor')
    expect(resolveE2eModel({ ...base, model: '  gpt-5  ' })).toBe('gpt-5')
  })

  test('formatDestination redacts only when E2E_REDACT=1', () => {
    const prev = process.env.E2E_REDACT
    try {
      delete process.env.E2E_REDACT
      expect(formatDestination('ABC_200_USER_EN')).toBe('ABC_200_USER_EN')
      process.env.E2E_REDACT = '1'
      expect(formatDestination('ABC_200_USER_EN')).toBe('<destination>')
    } finally {
      if (prev === undefined) delete process.env.E2E_REDACT
      else process.env.E2E_REDACT = prev
    }
  })
})
