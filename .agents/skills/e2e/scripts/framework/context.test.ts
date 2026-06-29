import { describe, expect, test } from 'bun:test'
import { getCliFlag, parseCli, resolveAcpAgent, resolveE2eExecutor } from './context'
import type { CliOptions } from './context'

describe('getCliFlag', () => {
  test('reads --flag value form', () => {
    expect(getCliFlag(['--destination', 'ABC_100_USER_EN'], '--destination')).toBe(
      'ABC_100_USER_EN'
    )
  })

  test('reads --flag=value form', () => {
    expect(getCliFlag(['--command=acp', 'mcp-1'], '--command')).toBe('acp')
  })

  test('returns undefined when flag missing', () => {
    expect(getCliFlag(['mcp-1'], '--command')).toBeUndefined()
  })
})

describe('resolveE2eExecutor', () => {
  test('defaults to local', () => {
    expect(resolveE2eExecutor(['mcp-1', '--destination', 'X'])).toBe('local')
  })

  test('accepts --acp', () => {
    expect(resolveE2eExecutor(['mcp-1', '--acp'])).toBe('acp')
  })
})

function baseCliOptions(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    list: false,
    evidence: false,
    executor: 'acp',
    args: {},
    ...overrides,
  }
}

describe('resolveAcpAgent', () => {
  test('requires --agent or ACP_AGENT', () => {
    expect(() => resolveAcpAgent(baseCliOptions())).toThrow(/requires --agent/)
  })

  test('reads --agent flag', () => {
    expect(resolveAcpAgent(baseCliOptions({ agent: 'devin' }))).toBe('devin')
  })
})

describe('parseCli', () => {
  test('parses scenario and dynamic args', () => {
    const opts = parseCli([
      'mcp-1',
      '--acp',
      '--agent',
      'cursor',
      '--destination',
      'ABC_100_USER_EN',
    ])
    expect(opts.executor).toBe('acp')
    expect(opts.scenario).toBe('mcp-1')
    expect(opts.args.destination).toBe('ABC_100_USER_EN')
    expect(opts.agent).toBe('cursor')
  })

  test('does not treat --config as dynamic arg', () => {
    const opts = parseCli(['mcp-1', '--config', 'e2e.config.yaml', '--destination', 'X'])
    expect(opts.args.config).toBeUndefined()
    expect(getCliFlag(['mcp-1', '--config', 'e2e.config.yaml'], '--config')).toBe('e2e.config.yaml')
  })
})
