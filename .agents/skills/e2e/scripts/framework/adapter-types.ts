import type { RunContext, Scenario } from './types'

/** Project-owned plugin: how to reach real services for scenario steps. */
export interface ToolExecutor {
  start(): Promise<void>
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
  close(): void
}

export interface E2eProjectAdapter {
  /** Map CLI/env params into RunContext values (e.g. partial ids → full ids). */
  resolveParams?(
    raw: Record<string, string | boolean | number>,
    suiteId: string
  ): Promise<Record<string, unknown>> | Record<string, unknown>

  /** Create a transport for one scenario run. */
  createExecutor(scenario: Scenario, ctx: RunContext, suiteId: string): ToolExecutor

  /** Optional label for evidence (e.g. "stdio-http", "grpc"). */
  serviceMode?(scenario: Scenario, suiteId: string): string
}
