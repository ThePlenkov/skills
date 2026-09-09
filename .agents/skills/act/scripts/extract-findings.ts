#!/usr/bin/env bun
/**
 * Extract scorable findings from a GitHub PR or GitLab MR into a JSONL sidecar.
 *
 * Runtime: `bun` (direct) or `npx --yes tsx@4` (Node.js ≥ 18). No Bun-specific
 * APIs are used — the script imports only `node:` built-ins.
 *
 * Two finding kinds:
 *   - code_scan   — one per check-run annotation (GitHub: Codacy, Opengrep,
 *     CodeQL, …) or one per MR vulnerability finding (GitLab Ultimate SAST).
 *   - code_review — one per top-level inline review comment (human or AI
 *     reviewer). GitHub: PR review comments; GitLab: MR diff-note discussions.
 *
 * Output: one JSON object per line on stdout (the agent reads this once; the
 * submit step joins ratings back against it by `finding_id`). Diagnostics go to
 * stderr. The script does all fetch/parse/latency work so the agent spends no
 * tool calls on mechanics — see AGENTS.md "Script over steps".
 *
 * Usage:
 *   GitHub: extract-findings.ts OWNER REPO PR_NUMBER > tmp/agent_xyz/findings.jsonl
 *   GitLab: extract-findings.ts GROUP PROJECT MR_IID  > tmp/agent_xyz/findings.jsonl
 *           (subgroups: GROUP/SUBGROUP as OWNER, PROJECT as REPO)
 *
 * detection_latency_ms is (detected − committed). For code_scan that is tool
 * latency; for code_review it includes reviewer availability — split by
 * `type` when analysing.
 */
import { spawnSync } from "node:child_process";
import {
  detectProvider,
  gitlabMrWebUrl,
  gitlabRestProject,
  type Provider,
} from "./lib/platform.ts";

const SUMMARY_MAX = 100

interface PrArgs {
  owner: string
  repo: string
  pr: string
  provider: Provider
  /** `owner/repo` for GitHub or full `group/project` path for GitLab. */
  project: string
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
  const proc = spawnSync('gh', args, {
    stdout: 'pipe',
    stderr: 'pipe',
    encoding: 'utf8',
    // Node's spawnSync caps stdout at 1MB by default; Bun.spawnSync had no
    // cap. With --paginate on a large PR, check-runs/annotations/review-comments
    // responses can exceed 1MB, causing status=null and truncated output.
    maxBuffer: 64 * 1024 * 1024,
  })
  if (proc.status !== 0) {
    const err = (proc.stderr ?? '').trim()
    throw new Error(`gh ${args[0]} failed: ${err}`)
  }
  return proc.stdout ?? ''
}

function ensureGhAuth(): void {
  const proc = spawnSync('gh', ['auth', 'status'], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
  if (proc.status !== 0) {
    console.error('error: gh not authenticated')
    process.exit(1)
  }
}

function parseArgs(argv: string[]): PrArgs {
  const [owner, repo, pr] = argv
  const missing = [owner, repo, pr].some((v) => !v)
  if (missing) {
    console.error('Usage: extract-findings.ts OWNER REPO PR_NUMBER|MR_IID')
    process.exit(2)
  }
  const provider = detectProvider()
  return { owner, repo, pr, provider, project: `${owner}/${repo}` }
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

// ---------------------------------------------------------------------------
// GitLab extraction (REST). Mirrors the GitHub flow: commit info → scan
// findings (MR vulnerability_findings, Ultimate-tier, degrades gracefully) →
// review findings (MR diff-note discussions). See issue #284.
// ---------------------------------------------------------------------------

interface GitLabMr {
  sha?: string
  web_url?: string
  head_pipeline?: { id?: number; status?: string; detailed_status?: { state?: string } } | null
}

interface GitLabCommit {
  committed_date?: string
}

interface GitLabNote {
  id: number
  body?: string
  system?: boolean
  author?: { username?: string }
  created_at?: string
  position?: {
    new_path?: string | null
    old_path?: string | null
    new_line?: number | null
    old_line?: number | null
  } | null
}

interface GitLabDiscussion {
  id: string
  notes: GitLabNote[]
}

interface GitLabVulnerabilityFinding {
  uuid?: string
  name?: string
  description?: string
  scanner?: { name?: string }
  location?: { file?: string; start_line?: number } | null
  scan?: { start_time?: string; end_time?: string } | null
}

function gitlabCommitInfo(a: PrArgs): CommitInfo {
  const mr = gitlabRestProject<GitLabMr>(a.project, `merge_requests/${a.pr}`)
  const sha = mr.sha || ''
  if (!sha) throw new Error(`GitLab MR !${a.pr} has no head sha in ${a.project}`)
  const commit = gitlabRestProject<GitLabCommit>(a.project, `repository/commits/${sha}`)
  return { sha, committedAt: commit.committed_date || '' }
}

function gitlabReviewFindings(opts: { a: PrArgs; commit: CommitInfo }): Finding[] {
  const mr = gitlabRestProject<GitLabMr>(opts.a.project, `merge_requests/${opts.a.pr}`)
  const mrUrl = mr.web_url || gitlabMrWebUrl(opts.a.project, opts.a.pr)
  const out: Finding[] = []
  let page = 1
  while (true) {
    const batch = gitlabRestProject<GitLabDiscussion[]>(
      opts.a.project,
      `merge_requests/${opts.a.pr}/discussions`,
      { query: { per_page: 100, page } },
    )
    if (!Array.isArray(batch) || batch.length === 0) break
    for (const d of batch) {
      const note = d.notes?.[0]
      if (!note || note.system) continue
      if (!note.position) continue // only diff-note discussions are review findings
      const pos = note.position
      const file = pos.new_path || pos.old_path || undefined
      const line = pos.new_line ?? pos.old_line ?? undefined
      const detected = note.created_at ?? opts.commit.committedAt
      out.push({
        finding_id: `review:${note.id}`,
        type: 'code_review',
        tool_name: note.author?.username ?? 'unknown',
        finding_url: `${mrUrl}#note_${note.id}`,
        summary: truncate(note.body ?? ''),
        file,
        line,
        commit_timestamp: opts.commit.committedAt,
        detected_timestamp: detected,
        detection_latency_ms: latencyMs({ from: opts.commit.committedAt, to: detected }),
      })
    }
    if (batch.length < 100) break
    page += 1
  }
  return out
}

function gitlabScanFindings(opts: { a: PrArgs; commit: CommitInfo }): Finding[] {
  // `/merge_requests/:iid/vulnerability_findings` is Ultimate-tier. On
  // non-Ultimate tiers (or when no security report ran) this 404s and the
  // outer safe() swallows it — yielding zero scan findings, which is honest.
  const mr = gitlabRestProject<GitLabMr>(opts.a.project, `merge_requests/${opts.a.pr}`)
  const mrUrl = mr.web_url || gitlabMrWebUrl(opts.a.project, opts.a.pr)
  const out: Finding[] = []
  let page = 1
  while (true) {
    const batch = gitlabRestProject<GitLabVulnerabilityFinding[]>(
      opts.a.project,
      `merge_requests/${opts.a.pr}/vulnerability_findings`,
      { query: { per_page: 100, page } },
    )
    if (!Array.isArray(batch) || batch.length === 0) break
    batch.forEach((vf, index) => {
      const detected = vf.scan?.end_time || vf.scan?.start_time || opts.commit.committedAt
      out.push({
        finding_id: `scan:${vf.uuid || `${page}:${index}`}`,
        type: 'code_scan',
        tool_name: vf.scanner?.name ?? 'unknown',
        finding_url: mrUrl,
        summary: truncate(vf.name || vf.description || ''),
        file: vf.location?.file,
        line: vf.location?.start_line,
        commit_timestamp: opts.commit.committedAt,
        detected_timestamp: detected,
        detection_latency_ms: latencyMs({ from: opts.commit.committedAt, to: detected }),
      })
    })
    if (batch.length < 100) break
    page += 1
  }
  return out
}

function main(): void {
  const a = parseArgs(process.argv.slice(2))

  if (a.provider === 'gitlab') {
    const commit = gitlabCommitInfo(a)
    const findings = [
      ...safe('vulnerability-findings', () => gitlabScanFindings({ a, commit })),
      ...safe('review-discussions', () => gitlabReviewFindings({ a, commit })),
    ]
    for (const finding of findings) {
      console.log(JSON.stringify(finding))
    }
    console.error(
      `extracted ${findings.length} findings (commit ${commit.sha.slice(0, 7)} @ ${commit.committedAt})`
    )
    return
  }

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
