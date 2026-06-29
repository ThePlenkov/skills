import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildE2eDispatch, dispatchRunId, formatDispatchInstructions } from './dispatch'
import type { CliOptions } from './context'
import type { ProjectE2eConfig } from './project-config'

const repoRoot = join(import.meta.dir, '..', '..', '..', '..', '..')

const projectConfig: ProjectE2eConfig = {
  adapter: 'e2e/openadt-adapter.ts',
  specPath: 'specs/mcp-ai-testing.md',
  suites: {
    mcp: { dir: 'e2e/scenarios/launcher', codePrefix: 'mcp-' },
    adtls: { dir: 'e2e/scenarios/adt-lsp', codePrefix: 'ls-' },
  },
}

const baseOpts = (): CliOptions => ({
  scenario: 'mcp-1',
  list: false,
  evidence: true,
  agent: 'devin',
  executor: 'acp',
  args: { destination: 'ABC_100_USER_EN' },
})

describe('dispatchRunId', () => {
  test('embeds scenario code and dispatch marker', () => {
    const id = dispatchRunId('mcp-1', new Date('2026-06-10T14:00:00.000Z'))
    expect(id).toMatch(/^2026-06-10T14-00-00Z-dispatch-mcp-1-[0-9a-f]{8}$/)
  })
})

describe('buildE2eDispatch', () => {
  test('builds ACP handoff payload', () => {
    const payload = buildE2eDispatch(baseOpts(), repoRoot, {
      configPath: join(repoRoot, 'e2e.config.yaml'),
      projectConfig,
      usageExample: 'e2e-agent dispatch mcp-1 --config e2e.config.yaml --acp --agent devin',
    })
    expect(payload.executor).toBe('acp')
    expect(payload.acpAgent).toBe('devin')
    expect(payload.scenario).toBe('mcp-1')
    expect(payload.ctx.destination).toBe('ABC_100_USER_EN')
    expect(payload.command.local).toContain('e2e/cli.ts run mcp-1')
    expect(payload.command.local).toContain('--agent devin')
    expect(payload.prompt).toContain('mcp-1-list-destinations.md')
    expect(payload.env.ACP_AGENT).toBe('devin')
    expect(payload.status).toBe('pending')
  })

  test('requires scenario code', () => {
    expect(() =>
      buildE2eDispatch({ ...baseOpts(), scenario: undefined }, repoRoot, {
        configPath: 'e2e.config.yaml',
        projectConfig,
        usageExample: 'e2e-agent dispatch …',
      })
    ).toThrow(/requires a scenario/)
  })

  test('requires ACP agent id', () => {
    expect(() =>
      buildE2eDispatch({ ...baseOpts(), agent: undefined }, repoRoot, {
        configPath: 'e2e.config.yaml',
        projectConfig,
        usageExample: 'e2e-agent dispatch …',
      })
    ).toThrow(/requires --agent/)
  })
})

describe('formatDispatchInstructions', () => {
  test('is ACP-neutral', () => {
    const payload = buildE2eDispatch(baseOpts(), repoRoot, {
      configPath: join(repoRoot, 'e2e.config.yaml'),
      projectConfig,
      usageExample: 'e2e-agent dispatch …',
    })
    const text = formatDispatchInstructions(payload)
    expect(text).toContain('ACP external executor')
    expect(text).toContain('agentclientprotocol.com')
    expect(text).toContain('devin')
  })
})
