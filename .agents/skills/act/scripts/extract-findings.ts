#!/usr/bin/env bun
/**
 * Extract scorable findings from a GitHub PR into a JSONL sidecar.
 *
 * Two finding kinds:
 *   - code_scan   — one per check-run annotation (Codacy, Opengrep, CodeQL, …)
 *   - code_review — one per top-level inline review comment (human or AI reviewer)
 *
 * Output: one JSON object per line on stdout (the agent reads this once; the
 * submit step joins ratings back against it by `finding_id`). Diagnostics go to
 * stderr. The script does all fetch/parse/latency work so the agent spends no
 * tool calls on mechanics — see AGENTS.md "Script over steps".
 *
 * Usage: extract-findings.ts OWNER REPO PR_NUMBER > /tmp/agent_xyz/findings.jsonl
 *
 * detection_latency_ms is (detected − committed). For code_scan that is tool
 * latency; for code_review it includes reviewer availability — split by
 * `type` when analysing.
 */
const SUMMARY_MAX = 100

interface PrArgs {
  owner: string
  repo: string
  pr: string
}

interface CommitInfo {
  sha: string
  committedAt: string
}

interface Annotation {
  path?: string
  start_line?: number
  title?: string
  message?: string
}

interface CheckRun {
  id: number
  name?: string
  html_url?: string
  completed_at?: string
  output?: { annotations_count?: number }
}

interface ReviewComment {
  id: number
  html_url?: string
  body?: string
  user?: { login?: string }
  created_at?: string
  path?: string
  line?: number | null
  in_reply_to_id?: number | null
}

interface Finding {
  finding_id: string
  type: 'code_scan' | 'code_review'
  tool_name: string
  finding_url: string
  summary: string
  file?: string
  line?: number
  commit_timestamp: string
  detected_timestamp: string
  detection_latency_ms: number
}

function gh(args: string[]): string {
  const proc = Bun.spawnSync(['gh', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (proc.exitCode !== 0) {
    const err = new TextDecoder().decode(proc.stderr).trim()
    throw new Error(`gh ${args[0]} failed: ${err}`)
  }
  return new TextDecoder().decode(proc.stdout)
}

function ensureGhAuth(): void {
  const proc = Bun.spawnSync(['gh', 'auth', 'status'], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
  if (proc.exitCode !== 0) {
    console.error('error: gh not authenticated')
    process.exit(1)
  }
}

function parseArgs(argv: string[]): PrArgs {
  const [owner, repo, pr] = argv
  const missing = [owner, repo, pr].some((v) => !v)
  if (missing) {
    console.error('Usage: extract-findings.ts OWNER REPO PR_NUMBER')
    process.exit(2)
  }
  return { owner, repo, pr }
}

function truncate(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > SUMMARY_MAX ? `${flat.slice(0, SUMMARY_MAX - 1)}…` : flat
}

function latencyMs(opts: { from: string; to: string }): number {
  const ms = new Date(opts.to).getTime() - new Date(opts.from).getTime()
  return Number.isFinite(ms) && ms > 0 ? ms : 0
}

function getCommitInfo(a: PrArgs): CommitInfo {
  const viewed = JSON.parse(
    gh(['pr', 'view', a.pr, '--repo', `${a.owner}/${a.repo}`, '--json', 'headRefOid'])
  ) as { headRefOid: string }
  const committedAt = gh([
    'api',
    `repos/${a.owner}/${a.repo}/commits/${viewed.headRefOid}`,
    '--jq',
    '.commit.committer.date',
  ]).trim()
  return { sha: viewed.headRefOid, committedAt }
}

function fetchCheckRuns(opts: { a: PrArgs; sha: string }): CheckRun[] {
  const raw = gh([
    'api',
    '--paginate',
    `repos/${opts.a.owner}/${opts.a.repo}/commits/${opts.sha}/check-runs`,
    '--jq',
    '.check_runs[]',
  ])
  return raw
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as CheckRun)
}

function fetchAnnotations(opts: { a: PrArgs; run: CheckRun }): Annotation[] {
  if ((opts.run.output?.annotations_count ?? 0) <= 0) {
    return []
  }
  try {
    const raw = gh([
      'api',
      '--paginate',
      `repos/${opts.a.owner}/${opts.a.repo}/check-runs/${opts.run.id}/annotations`,
      '--jq',
      '.[]',
    ])
    return raw
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as Annotation)
  } catch {
    return []
  }
}

function scanToFinding(opts: {
  run: CheckRun
  ann: Annotation
  index: number
  commit: CommitInfo
}): Finding {
  const detected = opts.run.completed_at ?? opts.commit.committedAt
  return {
    finding_id: `scan:${opts.run.id}:${opts.index}`,
    type: 'code_scan',
    tool_name: opts.run.name ?? 'unknown',
    finding_url: opts.run.html_url ?? '',
    summary: truncate(opts.ann.title || opts.ann.message || ''),
    file: opts.ann.path,
    line: opts.ann.start_line,
    commit_timestamp: opts.commit.committedAt,
    detected_timestamp: detected,
    detection_latency_ms: latencyMs({
      from: opts.commit.committedAt,
      to: detected,
    }),
  }
}

function scanFindings(opts: { a: PrArgs; runs: CheckRun[]; commit: CommitInfo }): Finding[] {
  const out: Finding[] = []
  for (const run of opts.runs) {
    const anns = fetchAnnotations({ a: opts.a, run })
    anns.forEach((ann, index) => out.push(scanToFinding({ run, ann, index, commit: opts.commit })))
  }
  return out
}

function isTopLevel(comment: ReviewComment): boolean {
  return comment.in_reply_to_id === null || comment.in_reply_to_id === undefined
}

function reviewToFinding(opts: { comment: ReviewComment; commit: CommitInfo }): Finding {
  const c = opts.comment
  const detected = c.created_at ?? opts.commit.committedAt
  return {
    finding_id: `review:${c.id}`,
    type: 'code_review',
    tool_name: c.user?.login ?? 'unknown',
    finding_url: c.html_url ?? '',
    summary: truncate(c.body ?? ''),
    file: c.path,
    line: c.line ?? undefined,
    commit_timestamp: opts.commit.committedAt,
    detected_timestamp: detected,
    detection_latency_ms: latencyMs({
      from: opts.commit.committedAt,
      to: detected,
    }),
  }
}

function reviewFindings(opts: { a: PrArgs; commit: CommitInfo }): Finding[] {
  const raw = gh([
    'api',
    '--paginate',
    `repos/${opts.a.owner}/${opts.a.repo}/pulls/${opts.a.pr}/comments`,
    '--jq',
    '.[]',
  ])
  const comments = raw
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as ReviewComment)
  return comments
    .filter(isTopLevel)
    .map((comment) => reviewToFinding({ comment, commit: opts.commit }))
}

function safe<T>(label: string, fn: () => T[]): T[] {
  try {
    return fn()
  } catch (error) {
    console.error(`warn: ${label}: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

function main(): void {
  const a = parseArgs(process.argv.slice(2))
  ensureGhAuth()
  const commit = getCommitInfo(a)
  const runs = safe('list-runs', () => fetchCheckRuns({ a, sha: commit.sha }))
  const findings = [
    ...safe('check-runs', () => scanFindings({ a, runs, commit })),
    ...safe('review-comments', () => reviewFindings({ a, commit })),
  ]
  for (const finding of findings) {
    console.log(JSON.stringify(finding))
  }
  console.error(
    `extracted ${findings.length} findings (commit ${commit.sha.slice(0, 7)} @ ${commit.committedAt})`
  )
}

main()
