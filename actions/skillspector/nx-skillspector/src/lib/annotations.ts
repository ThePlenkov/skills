/**
 * Mapping: skillspector JSON → GitHub Actions workflow commands.
 */
import type { SkillspectorIssue } from './mapping.ts';
import { SEVERITY_TO_LEVEL } from './sarif.ts';

const LEVEL_TO_GH_CMD: Record<string, 'error' | 'warning' | 'notice'> = {
  error: 'error',
  warning: 'warning',
  note: 'notice',
  none: 'notice',
};

const MAX_SNIPPET_LENGTH = 400;

export function buildTitle(
  ruleId: string,
  properties: Record<string, unknown>,
  toolName = 'skillspector',
): string {
  const parts: string[] = [];
  const tags = properties.tags as string[] | undefined;
  if (tags && tags.length > 0) {
    const seen = new Set<string>();
    const tagStrs: string[] = [];
    for (const t of tags) {
      if (t && !seen.has(t)) {
        seen.add(t);
        tagStrs.push(String(t));
      }
    }
    if (tagStrs.length > 0) parts.push('[' + tagStrs.join(' ') + ']');
  }
  parts.push(toolName + '[' + ruleId + ']');
  const category = properties.category as string | undefined;
  if (category) parts.push(': ' + category);
  return parts.join('');
}

export function buildMessage(explanation: string, properties: Record<string, unknown>): string {
  const out: string[] = [];
  if (properties.intent) out.push('Intent: ' + String(properties.intent));
  if (explanation) out.push(explanation);
  if (properties.remediation) out.push('Fix: ' + String(properties.remediation));
  const snippet = properties.code_snippet as string | undefined;
  if (snippet) {
    const flat = snippet.replace(/\r?\n/g, ' ⏎ ');
    const truncated = flat.length > MAX_SNIPPET_LENGTH
      ? flat.slice(0, MAX_SNIPPET_LENGTH - 1) + '…'
      : flat;
    out.push('Code: ' + truncated);
  }
  const confidence = properties.confidence as number | undefined;
  if (confidence !== undefined && confidence !== null) {
    try {
      const pct = Math.round(Number(confidence) * 100);
      // No literal '%' here — see sarif-to-annotations SKILL.md for why
      // GitHub's %25 double-escape would corrupt the rendering.
      out.push('confidence=' + pct);
    } catch { /* ignore non-numeric confidence */ }
  }
  return out.join(' — ');
}

export function issueToAnnotation(issue: SkillspectorIssue, toolName = 'skillspector'): string {
  const sev = (issue.severity ?? '').toUpperCase();
  const level = SEVERITY_TO_LEVEL[sev] ?? 'warning';
  const ghCmd = LEVEL_TO_GH_CMD[level] ?? 'notice';

  const properties: Record<string, unknown> = {};
  for (const key of [
    'category', 'confidence', 'remediation', 'code_snippet',
    'intent', 'tags', 'pattern', 'finding',
  ] as const) {
    const v = issue[key];
    if (v !== undefined && v !== null && v !== '' &&
        !(Array.isArray(v) && v.length === 0)) {
      properties[key] = v;
    }
  }

  const ruleId = issue.id ?? '?';
  const title = buildTitle(ruleId, properties, toolName);
  const message = buildMessage(issue.explanation ?? '(no message)', properties);

  const loc = issue.location ?? {};
  const parts: string[] = [];
  if (loc.file) parts.push('file=' + loc.file);
  if (loc.start_line !== undefined && loc.start_line !== null) parts.push('line=' + loc.start_line);
  if (loc.end_line !== undefined && loc.end_line !== null) parts.push('endLine=' + loc.end_line);
  parts.push('title=' + title);
  const props = parts.join(',');

  const safe = message.replace(/%/g, '%25').replace(/\r/g, ' ').replace(/\n/g, ' ');
  return '::' + ghCmd + ' ' + props + '::' + safe;
}

export function issuesToAnnotations(issues: SkillspectorIssue[], toolName = 'skillspector'): string[] {
  return issues.map((i) => issueToAnnotation(i, toolName));
}