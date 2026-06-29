/**
 * Mapping: skillspector JSON → SARIF 2.1.0.
 * Preserves category, confidence, remediation, code_snippet, intent,
 * tags, end_line under SARIF's standard `properties` extension point.
 */
import { SARIF_SCHEMA_URL, SEVERITY_TO_LEVEL, type SarifLog, type SarifResult, type SarifRule, type SarifRun } from './sarif.ts';

export interface SkillspectorIssue {
  id?: string;
  category?: string;
  severity?: string;
  confidence?: number;
  location?: { file?: string; start_line?: number; end_line?: number };
  explanation?: string;
  remediation?: string;
  code_snippet?: string;
  intent?: string;
  tags?: string[];
  pattern?: string;
  finding?: string;
}

export interface SkillspectorDoc {
  metadata?: { skillspector_version?: string };
  skill?: { name?: string; source?: string };
  issues?: SkillspectorIssue[];
}

const PROPERTY_KEYS = [
  'category', 'confidence', 'remediation', 'code_snippet',
  'intent', 'tags', 'pattern', 'finding',
] as const;

function issueToResult(issue: SkillspectorIssue, ruleIndex: Map<string, number>): SarifResult {
  const sev = (issue.severity ?? '').toUpperCase();
  const level = SEVERITY_TO_LEVEL[sev] ?? 'warning';
  const loc = issue.location ?? {};
  const artifactUri = loc.file ?? '';

  const physicalLocation: { artifactLocation: { uri: string }; region?: object } = {
    artifactLocation: { uri: artifactUri },
  };
  const region: { startLine?: number; endLine?: number } = {};
  if (loc.start_line !== undefined && loc.start_line !== null) region.startLine = loc.start_line;
  if (loc.end_line !== undefined && loc.end_line !== null) region.endLine = loc.end_line;
  if (Object.keys(region).length > 0) physicalLocation.region = region;

  const properties: Record<string, unknown> = {};
  for (const key of PROPERTY_KEYS) {
    const val = issue[key];
    if (val !== undefined && val !== null && val !== '' &&
        !(Array.isArray(val) && val.length === 0)) {
      properties[key] = val;
    }
  }

  // If the issue has no rule id, emit a synthetic ruleIndex pointing
  // at an inline placeholder rule built below. Without this guard,
  // ruleIndex defaulted to 0 and pointed at whatever rule happened
  // to be first in the array — silently attributing the finding
  // to the wrong rule in SARIF viewers.
  const ruleId = issue.id;
  if (!ruleId) {
    return {
      ruleId: 'unknown-rule',
      ruleIndex: -1,
      level,
      message: { text: issue.explanation ?? '(no explanation)' },
      ...(artifactUri ? { locations: [{ physicalLocation }] } : {}),
      ...(Object.keys(properties).length > 0 ? { properties } : {}),
    };
  }
  const result: SarifResult = {
    ruleId,
    level,
    message: { text: issue.explanation ?? '(no explanation)' },
    ruleIndex: ruleIndex.get(ruleId) ?? 0,
  };
  if (artifactUri) result.locations = [{ physicalLocation }];
  if (Object.keys(properties).length > 0) result.properties = properties;
  return result;
}

function issuesToRules(issues: SkillspectorIssue[]): { rules: SarifRule[]; index: Map<string, number> } {
  const seen = new Set<string>();
  const rules: SarifRule[] = [];
  const index = new Map<string, number>();
  for (const issue of issues) {
    const id = issue.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const idx = rules.length;
    rules.push({
      id,
      name: id,
      shortDescription: { text: issue.category ?? id },
      fullDescription: { text: issue.explanation ?? '' },
      ...(issue.tags ? { properties: { tags: issue.tags } } : {}),
      ...(issue.remediation
        ? { help: { text: issue.remediation, markdown: `**Fix:** ${issue.remediation}` } }
        : {}),
    });
    index.set(id, idx);
  }
  return { rules, index };
}

export function buildSarif(doc: SkillspectorDoc, toolName = 'skillspector'): SarifLog {
  const issues = doc.issues ?? [];
  const { rules, index } = issuesToRules(issues);
  const results = issues.map((i) => issueToResult(i, index));

  const run: SarifRun = {
    tool: {
      driver: {
        name: toolName,
        version: doc.metadata?.skillspector_version ?? '',
        informationUri: 'https://github.com/NVIDIA/skillspector',
        rules,
      },
    },
    results,
  };
  if (doc.skill?.source) {
    run.originalUriBaseIds = { PROJECTROOT: { uri: 'file://' + doc.skill.source } };
  }
  return { $schema: SARIF_SCHEMA_URL, version: '2.1.0', runs: [run] };
}

export function mergeSarif(logs: SarifLog[]): SarifLog {
  return {
    $schema: SARIF_SCHEMA_URL,
    version: '2.1.0',
    runs: logs.flatMap((l) => l.runs),
  };
}