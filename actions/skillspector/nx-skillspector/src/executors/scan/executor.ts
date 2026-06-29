/**
 * scan executor — runs `skillspector scan <path> --format json` and
 * emits GitHub workflow commands + optional SARIF.
 *
 * This executor is invoked once per inferred project (one SKILL.md).
 * Nx handles parallelism, caching, and per-skill hash inputs.
 */
import type { ExecutorContext } from "@nx/devkit";
import * as fs from 'node:fs';
import * as path from 'node:path';
import { issuesToAnnotations } from '../../lib/annotations.ts';
import { buildSarif, type SkillspectorDoc } from '../../lib/mapping.ts';
import { runSkillspector } from '../../lib/skillspector.ts';

export interface ScanExecutorOptions {
  path: string;
  sarif?: string;
  annotations?: boolean;
  failOnError?: boolean;
  jobSummary?: boolean;
  noLlM?: boolean;
  baseline?: string;
  skillspectorBin?: string;
}

// Named export alongside default so Nx's CJS-style
// (`module.default ?? module`) can find the executor either way.
export async function scanExecutorFn(
  options: ScanExecutorOptions,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
  return scanExecutor(options, context);
}

export default async function scanExecutor(
  options: ScanExecutorOptions,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
  const {
    path: skillPath,
    // Fall back to env vars exported by action.yml when the plugin
    // invocation didn't pass them as options. Without this fallback,
    // inputs like `sarif`, `fail-on-error`, `baseline`, and
    // `no-llm` from the composite action are silently ignored.
    sarif = process.env.SARIF_OUT || '',
    annotations = process.env.ANNOTATIONS_ENABLED !== 'false',
    failOnError = process.env.FAIL_ON_ERROR !== 'false',
    jobSummary = process.env.JOB_SUMMARY_ENABLED !== 'false',
    noLlM = process.env.SKILLSPECTOR_NO_LLM !== 'false',
    baseline = process.env.SKILLSPECTOR_BASELINE || '',
    skillspectorBin = process.env.SKILLSPECTOR_BIN || 'skillspector',
  } = options;

  // Nx's ExecutorContext.root is the workspace root. The project root
  // is the inferred project (skill dir). Resolve the path relative to
  // the project root when it's relative.
  const projectRoot = context.projectGraph?.nodes[context.projectName ?? '']?.data?.root
    ?? context.cwd;
  // Resolve `skillPath` against the workspace root, not the project
  // root. The project root is already a sub-path of the workspace;
  // resolving against it would double up the prefix.
  const resolvedPath = path.isAbsolute(skillPath)
    ? skillPath
    : path.resolve(context.root, skillPath);

  const skillName = path.basename(resolvedPath.replace(/[/\\]+$/, ''));
  console.log(`::group::Scanning ${skillName}`);

  const result = await runSkillspector({
    bin: skillspectorBin,
    path: resolvedPath,
    noLlM,
    baseline: baseline || undefined,
  });

  if (!result.jsonText) {
    console.log(`  (no JSON output — skillspector exit=${result.exitCode})`);
    console.log('::endgroup::');
    return { success: result.exitCode === 0 };
  }

  let doc: SkillspectorDoc;
  try {
    doc = JSON.parse(result.jsonText) as SkillspectorDoc;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`::error title=skillspector::invalid JSON: ${msg}`);
    console.log('::endgroup::');
    return { success: false };
  }

  const issues = doc.issues ?? [];

  if (annotations) {
    for (const line of issuesToAnnotations(issues)) {
      console.log(line);
    }
  }

  let errorCount = 0;
  let warningCount = 0;
  if (sarif) {
    const resolvedSarif = path.isAbsolute(sarif)
      ? sarif.replace(/\.sarif$/, `-${context.projectName}.sarif`)
      : path.resolve(context.root, sarif.replace(/\.sarif$/, `-${context.projectName}.sarif`));
    fs.mkdirSync(path.dirname(resolvedSarif), { recursive: true });

    // Merge with any pre-existing SARIF at this path (e.g., a prior
    // skill's run). Each executor invocation adds one run to the file.
    let existing: { runs?: unknown[] } = {};
    if (fs.existsSync(resolvedSarif)) {
      try { existing = JSON.parse(fs.readFileSync(resolvedSarif, 'utf8')); } catch { /* overwrite */ }
    }
    const fresh = buildSarif(doc);
    const merged = {
      $schema: fresh.$schema,
      version: '2.1.0' as const,
      runs: [...(existing.runs ?? []), ...fresh.runs],
    };
    fs.writeFileSync(resolvedSarif, JSON.stringify(merged, null, 2) + '\n');
  }

  for (const issue of issues) {
    const sev = (issue.severity ?? '').toUpperCase();
    if (sev === 'HIGH' || sev === 'CRITICAL') errorCount++;
    else if (sev === 'MEDIUM' || sev === 'WARNING') warningCount++;
  }

  console.log(`  findings=${issues.length} errors=${errorCount} warnings=${warningCount} ss_exit=${result.exitCode}`);
  console.log('::endgroup::');

  if (jobSummary && process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\n### ${skillName}\n` +
        `- Total findings: ${issues.length}\n` +
        `- Error-severity: ${errorCount}\n` +
        `- Warning-severity: ${warningCount}\n`,
    );
  }

  return { success: !failOnError || errorCount === 0 };
}