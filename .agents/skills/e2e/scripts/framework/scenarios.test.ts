import { describe, expect, test } from 'bun:test'
import {
  expectedScenarioFilename,
  filterScenarios,
  loadScenariosFromDir,
  normalizeScenarioCode,
  parseScenarioMarkdown,
  toScenario,
} from './scenarios'
import { join } from 'node:path'
import type { Scenario } from './types'

const sample = `---
code: mcp-99
id: demo
title: Demo scenario
mode: standalone
given: destination {{destination}} is ready
when: call adt_read_object
then: source is returned without error
steps:
  - tool: adt_read_object
    args:
      destination: "{{destination}}"
    assert:
      notError: true
---

# mcp-99 — Demo

Ask the user for destination.
`

describe('scenarios', () => {
  test('parseScenarioMarkdown splits frontmatter and body', () => {
    const { meta, body } = parseScenarioMarkdown(sample)
    expect(meta.code).toBe('mcp-99')
    expect(meta.id).toBe('demo')
    expect(body).toContain('# mcp-99')
  })

  test('toScenario normalizes code and validates filename', () => {
    const { meta, body } = parseScenarioMarkdown(sample)
    const s = toScenario('mcp-99-demo.md', meta, body)
    expect(s.code).toBe('mcp-99')
    expect(s.file).toBe('mcp-99-demo.md')
    expect(s.intent).toBe(body)
    expect(() => toScenario('demo.md', meta, body)).toThrow(/prefix-N-<id>\.md/)
    expect(() => toScenario('mcp-99-wrong-slug.md', meta, body)).toThrow(/expected mcp-99-demo\.md/)
  })

  test('expectedScenarioFilename follows mcp-N-id pattern', () => {
    expect(expectedScenarioFilename('mcp-1', 'list-destinations')).toBe(
      'mcp-1-list-destinations.md'
    )
  })

  test('loadScenariosFromDir loads launcher scenario files', () => {
    const dir = join(import.meta.dir, '..', '..', '..', '..', '..', 'e2e', 'scenarios', 'launcher')
    const all = loadScenariosFromDir(dir)
    expect(all.length).toBeGreaterThanOrEqual(5)
    const mcp1 = all.find((s) => s.code === 'mcp-1')
    expect(mcp1?.file).toBe('mcp-1-list-destinations.md')
    expect(mcp1?.id).toBe('list-destinations')
  })

  test('normalizeScenarioCode rejects invalid codes', () => {
    expect(() => normalizeScenarioCode('MCP-1')).not.toThrow()
    expect(normalizeScenarioCode('MCP-1')).toBe('mcp-1')
    expect(() => normalizeScenarioCode('read-standard-class')).toThrow()
  })

  test('filterScenarios matches code or id', () => {
    const gwt = { given: 'g', when: 'w', then: 't' }
    const all: Scenario[] = [
      {
        code: 'mcp-1',
        id: 'list-destinations',
        file: 'mcp-1-list-destinations.md',
        title: 't',
        intent: 'x',
        ...gwt,
        steps: [{ tool: 'abap_list_destinations' }],
      },
      {
        code: 'mcp-2',
        id: 'read-standard-class',
        file: 'mcp-2-read-standard-class.md',
        title: 't',
        intent: 'x',
        ...gwt,
        steps: [{ tool: 'adt_read_object' }],
      },
    ]
    expect(filterScenarios(all, 'mcp-2')).toHaveLength(1)
    expect(filterScenarios(all, 'read-standard-class')[0]?.code).toBe('mcp-2')
  })
})
