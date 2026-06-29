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
  _toolName = 'skillspector',
): string {
  // GitHub renders the workflow job name and tool name in the UI
  // header for each annotation, so the title only needs the signal a
  // reader can't get elsewhere: bracketed rule ID, then the
  // human-readable category. Older format was
  //   [<tag>]skillspector[<rule>]: <category>
  // which repeated the tool name and the category. The brackets
  // around the rule ID are kept so the title is visually scannable
  // when many findings are open at once.
  const category = properties.category as string | undefined;
  return '[' + ruleId + ']: ' + (category ?? ruleId);
}

export function buildMessage(explanation: string, properties: Record<string, unknown>): string {
  const out: string[] = [];
  if (properties.intent) out.push('Intent: ' + String(properties.intent));
  if (explanation) out.push(explanation);
  if (properties.remediation) out.push('Fix: ' + String(properties.remediation));
  const snippet = properties.code_snippet as string | undefined;
  if (snippet) {
    // GitHub's `::error ...::message` workflow command is single-line
    // — the parser splits stdout on newlines, so a literal \n in the
    // message would break the command at the next newline and the
    // rest would be logged as plain text. The previous fix used ' ⏎ '
    // as a visible line-break marker, but GitHub renders it as a
    // literal Unicode glyph and the result reads as gibberish.
    // Collapse snippet whitespace to single spaces; readers get the
    // full snippet via the SARIF code-scanning tab if they need it.
    const flat = snippet.replace(/\s+/g, ' ').trim();
    const truncated = flat.length > MAX_SNIPPET_LENGTH
      ? flat.slice(0, MAX_SNIPPET_LENGTH - 1) + '…'
      : flat;
    out.push('Code: ' + truncated);
  }
  const confidence = properties.confidence as number | undefined;
  if (confidence !== undefined && confidence !== null) {
    const parsed = Number(confidence);
    // Math.round(NaN) returns NaN silently (no throw), so the
    // previous try/catch never caught the case the comment warned
    // about. Check explicitly before rounding.
    if (!isNaN(parsed)) {
      const pct = Math.round(parsed * 100);
      out.push('confidence=' + pct);
    }
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
  if (loc.file) parts.push('file=' + escapeParam(loc.file));
  if (loc.start_line !== undefined && loc.start_line !== null) parts.push('line=' + loc.start_line);
  if (loc.end_line !== undefined && loc.end_line !== null) parts.push('endLine=' + loc.end_line);
  parts.push('title=' + escapeParam(title));
  const props = parts.join(',');

  const safe = message.replace(/%/g, '%25').replace(/\r/g, ' ').replace(/\n/g, ' ');
  return '::' + ghCmd + ' ' + props + '::' + safe;
}

// Escape a GitHub Actions workflow-command parameter value.
// `%` starts a data section, `\r`/`\n` terminate the command, `,` separates
// fields, `:` delimits the command prefix. Title and file in the
// comma-separated parameter list were unescaped before this fix and
// could truncate or split annotations containing these characters.
function escapeParam(s: string): string {
  return s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A').replace(/:/g, '%3A').replace(/,/g, '%2C');
}

export function issuesToAnnotations(issues: SkillspectorIssue[], toolName = 'skillspector'): string[] {
  return issues.map((i) => issueToAnnotation(i, toolName));
}