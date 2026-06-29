#!/usr/bin/env bun
/**
 * Resolve PR + merge SHA for review-debt harvest from a GitHub Actions event.
 *
 * Supports:
 *   - pull_request closed + merged
 *   - workflow_run after CI completes on a pull_request (merged PR only)
 *
 * Writes github-actions outputs: pr_number, merge_sha, should_harvest (true|false).
 *
 * Usage (local):
 *   GITHUB_EVENT_NAME=pull_request GITHUB_EVENT_PATH=/tmp/event.json \
 *     bun resolve-harvest-target.ts
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { gh } from './review-debt-gh.ts'

class EventFileError extends Error {
  constructor(
    public readonly path: string,
    cause: unknown
  ) {
    super(`failed to read or parse event file at ${path}: ${String(cause)}`)
    this.name = 'EventFileError'
  }
}

interface GhOutput {
  pr_number: string
  merge_sha: string
  should_harvest: string
  skip_reason: string
}

interface WorkflowRunPrRef {
  number?: number
}

interface PrMergeInfo {
  merged: boolean
  mergeCommit: { oid: string } | null
}

function writeOutputs(out: GhOutput): void {
  const path = process.env.GITHUB_OUTPUT
  if (!path) {
    console.log(JSON.stringify(out, null, 2))
    return
  }
  for (const [key, value] of Object.entries(out)) {
    appendFileSync(path, `${key}=${value}\n`)
  }
}

function skip(reason: string): void {
  writeOutputs({
    pr_number: '',
    merge_sha: '',
    should_harvest: 'false',
    skip_reason: reason,
  })
}

function harvestTarget(pr: number, mergeSha: string): void {
  writeOutputs({
    pr_number: String(pr),
    merge_sha: mergeSha,
    should_harvest: 'true',
    skip_reason: '',
  })
}

function isPositivePrNumber(n: unknown): n is number {
  return typeof n === 'number' && n > 0
}

export function workflowRunPrNumbers(
  pullRequests: WorkflowRunPrRef[] | null | undefined
): number[] {
  if (!pullRequests?.length) {
    return []
  }
  const out: number[] = []
  for (const ref of pullRequests) {
    if (!isPositivePrNumber(ref.number)) continue
    if (out.includes(ref.number)) continue
    out.push(ref.number)
  }
  return out
}

export function shouldHarvestAfterCiRun(opts: { event: string; conclusion: string }): boolean {
  return opts.event === 'pull_request' && opts.conclusion !== 'cancelled'
}

function readMergedPr(pr: number): PrMergeInfo | null {
  try {
    const raw = gh(['pr', 'view', String(pr), '--json', 'merged,mergeCommit'])
    return JSON.parse(raw) as PrMergeInfo
  } catch {
    return null
  }
}

interface WorkflowRunPayload {
  event?: string
  conclusion?: string
  pull_requests?: WorkflowRunPrRef[]
}

function firstMergedPr(candidates: number[]): { pr: number; sha: string } | null {
  for (const pr of candidates) {
    const info = readMergedPr(pr)
    if (info?.merged && info.mergeCommit?.oid) {
      return { pr, sha: info.mergeCommit.oid }
    }
  }
  return null
}

function resolveFromWorkflowRun(event: { workflow_run?: WorkflowRunPayload }): void {
  const run = event.workflow_run
  if (!run) {
    skip('missing workflow_run payload')
    return
  }
  if (
    !shouldHarvestAfterCiRun({
      event: run.event ?? '',
      conclusion: run.conclusion ?? '',
    })
  ) {
    skip(`CI run not eligible (event=${run.event}, conclusion=${run.conclusion})`)
    return
  }

  const candidates = workflowRunPrNumbers(run.pull_requests)
  if (candidates.length === 0) {
    skip('workflow_run has no linked pull_requests')
    return
  }

  const merged = firstMergedPr(candidates)
  if (!merged) {
    skip('linked PR(s) not merged yet')
    return
  }
  harvestTarget(merged.pr, merged.sha)
}

function readEvent(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch (cause) {
    throw new EventFileError(path, cause)
  }
}

function isMergedPullRequestPayload(
  value: unknown
): value is { merged: true; number: number; merge_commit_sha: string } {
  if (typeof value !== 'object' || value === null) return false
  const pr = value as Record<string, unknown>
  return (
    pr.merged === true &&
    typeof pr.number === 'number' &&
    typeof pr.merge_commit_sha === 'string' &&
    pr.merge_commit_sha.length > 0
  )
}

function resolvePullRequestEvent(event: Record<string, unknown>): void {
  if (isMergedPullRequestPayload(event.pull_request)) {
    const pr = event.pull_request
    harvestTarget(pr.number, pr.merge_commit_sha)
    return
  }
  skip('pull_request not merged')
}

function main(): void {
  const eventName = process.env.GITHUB_EVENT_NAME
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventName || !eventPath) {
    console.error('GITHUB_EVENT_NAME and GITHUB_EVENT_PATH are required')
    process.exit(1)
  }

  let event: Record<string, unknown>
  try {
    event = readEvent(eventPath)
  } catch (err) {
    if (err instanceof EventFileError) {
      console.error(err.message)
      process.exit(1)
    }
    throw err
  }

  if (eventName === 'pull_request') {
    resolvePullRequestEvent(event)
    return
  }
  if (eventName === 'workflow_run') {
    resolveFromWorkflowRun(event as Parameters<typeof resolveFromWorkflowRun>[0])
    return
  }
  skip(`unsupported event ${eventName}`)
}

if (import.meta.main) {
  main()
}
