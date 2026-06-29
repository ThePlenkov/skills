/**
 * Resolve which merged PR numbers to harvest under filter criteria.
 */
import { gh } from './review-debt-gh.ts'

export interface MergedPrCandidate {
  number: number
  mergedAt: string
  author: string
  labels: string[]
}

export interface HarvestPrFilters {
  prIds: number[]
  mergedSince: string | null
  mergedUntil: string | null
  lastN: number | null
  prAuthor: string | null
  labels: string[]
}

function parseCsvParts(value: string | null | undefined): string[] {
  if (!value?.trim()) {
    return []
  }
  return value.split(',').map((part) => part.trim())
}

function parseCsvMapped<T>(
  value: string | null | undefined,
  mapPart: (part: string) => T | null
): T[] {
  const out: T[] = []
  const seen = new Set<T>()
  for (const part of parseCsvParts(value)) {
    const mapped = mapPart(part)
    if (mapped === null || seen.has(mapped)) {
      continue
    }
    seen.add(mapped)
    out.push(mapped)
  }
  return out
}

export function parseCsvInts(value: string | null | undefined): number[] {
  return parseCsvMapped(value, (part) => {
    const n = Number(part)
    if (!Number.isFinite(n) || n <= 0) {
      return null
    }
    return n
  })
}

export function parseCsvStrings(value: string | null | undefined): string[] {
  return parseCsvMapped(value, (part) => (part.length > 0 ? part : null))
}

function dayStart(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00.000Z`).getTime()
}

function dayEnd(isoDate: string): number {
  return new Date(`${isoDate}T23:59:59.999Z`).getTime()
}

export function filterByMergedDate(
  prs: MergedPrCandidate[],
  since: string | null,
  until: string | null
): MergedPrCandidate[] {
  const sinceMs = since ? dayStart(since) : null
  const untilMs = until ? dayEnd(until) : null

  return prs.filter((pr) => {
    const mergedMs = new Date(pr.mergedAt).getTime()
    if (sinceMs !== null && mergedMs < sinceMs) {
      return false
    }
    if (untilMs !== null && mergedMs > untilMs) {
      return false
    }
    return true
  })
}

export function filterByLabels(prs: MergedPrCandidate[], required: string[]): MergedPrCandidate[] {
  if (required.length === 0) {
    return prs
  }
  const wanted = required.map((l) => l.toLowerCase())
  return prs.filter((pr) => {
    const have = new Set(pr.labels.map((l) => l.toLowerCase()))
    return wanted.every((label) => have.has(label))
  })
}

function isPositiveLastN(lastN: number | null): lastN is number {
  if (lastN === null) {
    return false
  }
  if (!Number.isFinite(lastN)) {
    return false
  }
  return lastN > 0
}

export function applyLastN(prs: MergedPrCandidate[], lastN: number | null): MergedPrCandidate[] {
  const sorted = [...prs].sort((a, b) => b.mergedAt.localeCompare(a.mergedAt))
  if (!isPositiveLastN(lastN)) {
    return sorted
  }
  return sorted.slice(0, lastN)
}

export function fetchMergedPrCandidates(opts: {
  owner: string
  repo: string
  prAuthor: string | null
  label: string | null
  limit: number
}): MergedPrCandidate[] {
  const args = [
    'pr',
    'list',
    '--repo',
    `${opts.owner}/${opts.repo}`,
    '--state',
    'merged',
    '--limit',
    String(opts.limit),
    '--json',
    'number,mergedAt,author,labels',
  ]
  if (opts.prAuthor) {
    args.push('--author', opts.prAuthor)
  }
  if (opts.label) {
    args.push('--label', opts.label)
  }

  const raw = JSON.parse(gh(args)) as Array<{
    number: number
    mergedAt: string | null
    author?: { login?: string }
    labels?: Array<{ name: string }>
  }>

  return raw
    .filter((row) => row.mergedAt)
    .map((row) => ({
      number: row.number,
      mergedAt: row.mergedAt!,
      author: row.author?.login ?? 'unknown',
      labels: (row.labels ?? []).map((l) => l.name),
    }))
}

function fetchExplicitMergedPrs(opts: {
  owner: string
  repo: string
  prIds: number[]
}): MergedPrCandidate[] {
  const out: MergedPrCandidate[] = []
  for (const number of opts.prIds) {
    let viewed: {
      number: number
      mergedAt: string | null
      state: string
      author?: { login?: string }
      labels?: Array<{ name: string }>
    }
    try {
      viewed = JSON.parse(
        gh([
          'pr',
          'view',
          String(number),
          '--repo',
          `${opts.owner}/${opts.repo}`,
          '--json',
          'number,mergedAt,author,labels,state',
        ])
      ) as typeof viewed
    } catch {
      console.error(`warning: PR #${number} fetch failed — skipped`)
      continue
    }
    if (viewed.state !== 'MERGED' || !viewed.mergedAt) {
      console.error(`warning: PR #${number} is not merged — skipped`)
      continue
    }
    out.push({
      number: viewed.number,
      mergedAt: viewed.mergedAt,
      author: viewed.author?.login ?? 'unknown',
      labels: (viewed.labels ?? []).map((l) => l.name),
    })
  }
  return out
}

export function resolveHarvestPrs(opts: {
  owner: string
  repo: string
  filters: HarvestPrFilters
  listLimit?: number
}): MergedPrCandidate[] {
  const limit = opts.listLimit ?? 100

  let candidates: MergedPrCandidate[]
  if (opts.filters.prIds.length > 0) {
    candidates = fetchExplicitMergedPrs({
      owner: opts.owner,
      repo: opts.repo,
      prIds: opts.filters.prIds,
    })
  } else {
    const label = opts.filters.labels[0] ?? null
    candidates = fetchMergedPrCandidates({
      owner: opts.owner,
      repo: opts.repo,
      prAuthor: opts.filters.prAuthor,
      label,
      limit,
    })
    candidates = filterByLabels(candidates, opts.filters.labels)
  }

  candidates = filterByMergedDate(candidates, opts.filters.mergedSince, opts.filters.mergedUntil)
  return applyLastN(candidates, opts.filters.lastN)
}

export function hasHarvestSelection(filters: HarvestPrFilters): boolean {
  return (
    filters.prIds.length > 0 ||
    filters.mergedSince !== null ||
    filters.mergedUntil !== null ||
    (filters.lastN !== null && filters.lastN > 0) ||
    filters.prAuthor !== null ||
    filters.labels.length > 0
  )
}
