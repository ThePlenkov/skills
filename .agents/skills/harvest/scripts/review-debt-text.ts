/**
 * Text normalization and fingerprinting for review-debt rows.
 */
import { createHash } from 'node:crypto'

const PREVIEW_MAX = 120

export function normalizeBody(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

export interface ThreadFingerprintInput {
  body: string
  path: string
}

export function fingerprint(input: ThreadFingerprintInput): string {
  const payload = `${normalizeBody(input.body)}|${input.path}`
  return `sha256:${createHash('sha256').update(payload).digest('hex').slice(0, 16)}`
}

export function deriveArea(filePath: string): string {
  if (!filePath || filePath === '-') {
    return '(no path)'
  }
  const parts = filePath.split('/').filter(Boolean)
  if (parts.length <= 2) {
    return parts.join('/') || '(root)'
  }
  return parts.slice(0, 2).join('/')
}

export function bodyPreview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_MAX ? `${flat.slice(0, PREVIEW_MAX - 1)}…` : flat
}
