/**
 * Nx executor — runs Skillspector on a single skill and emits
 * GitHub Actions annotations + a structured job summary.
 *
 * Per-skill invocation pattern (called once per skill by Nx):
 *   1. Run `skillspector scan <skill>` → JSON
 *   2. Rewrite issue.location.file to be workspace-relative (so
 *      `::error file=…` resolves to a real file in the repo, not
 *      the GitHub Actions default of `.github`).
 *   3. Filter annotations: only emit `::error`/`::warning` for code
 *      files (.ts/.js/.py/.sh/.yml/.json). Markdown docs flagged by
 *      the scanner are policy/prose, not code — they belong in the
 *      summary, not in the Files tab.
 *   4. Append a Markdown row to the per-skill summary file so the
 *      outer workflow step can build the consolidated report.
 *   5. Append a Markdown section to $GITHUB_STEP_SUMMARY (the
 *      Actions run page's "Summary" tab).
 */
import type { ExecutorContext } from '@nx/devkit';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { issuesToAnnotations } from '../../lib/annotations.ts';
import {
  buildSarif,
  type SkillspectorDoc,
  type SkillspectorIssue,
} from '../../lib/mapping.ts';
import { runSkillspector } from '../../lib/skillspector.ts';

const CODE_FILE_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|sh|bash|zsh|yml|yaml|json|go|rs|java|rb|php)$/i;

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
    noLlM = process.env.SKILLSPECTOR_NO_LLM !== 'false',
    baseline = process.env.SKILLSPECTOR_BASELINE || '',
    skillspectorBin = process.env.SKILLSPECTOR_BIN || 'skillspector',
  } = options;

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

  // Rewrite each issue's location.file to a workspace-relative path
  // so `::error file=…` resolves to a real file. Skillspector returns
  // paths relative to its scan root (e.g. `SKILL.md`,
  // `references/foo.md`); joining with the scan root fixes the GitHub
  // Actions default of `.github` when the path can't be resolved.
  const skillRootAbs = path.resolve(resolvedPath);
  for (const issue of issues) {
    const loc = issue.location;
    if (!loc?.file) continue;
    if (path.isAbsolute(loc.file)) continue;
    const absolute = path.resolve(skillRootAbs, loc.file);
    loc.file = path.relative(context.root, absolute);
  }

  // Categorise issues for output filtering:
  // - codeFindings: in code files → emit as GitHub annotations + include
  //   in the summary with file:line deep links
  // - docFindings: in .md/.txt/etc → only include in the summary; these
  //   are usually the scanner flagging policy/prose, not actionable code
  const codeFindings: SkillspectorIssue[] = [];
  const docFindings: SkillspectorIssue[] = [];
  for (const issue of issues) {
    const filePath = issue.location?.file ?? '';
    if (CODE_FILE_RE.test(filePath)) codeFindings.push(issue);
    else docFindings.push(issue);
  }

  if (annotations && codeFindings.length > 0) {
    // Write each annotation line to a shared file rather than
    // echoing it via console.log. Nx prefixes every line of worker
    // stdout with ANSI-coloured "project-name:" + a TTY reset, e.g.
    //   "\x1b[1m\x1b[36mminimal-root-cause:\x1b[39m\x1b[22m ::error file=…"
    // GitHub's workflow-command parser keys on the literal "::error"
    // token at the start of the line (or after a project-name
    // prefix it doesn't strip), so Nx-prefixed lines are dropped
    // from the check-run's annotations API and the PR Files tab
    // shows nothing.
    //
    // The action's outer step cats this file at the end of nx, so
    // the workflow commands reach the runner cleanly (no ANSI, no
    // project prefix). Each executor invocation appends; the final
    // cat prints them in skill order, which matches the iteration
    // order of nx run-many / nx affected.
    const annotationsPath = process.env.ANNOTATIONS_FILE
      ?? '/tmp/nx-skillspector-annotations.log';
    fs.mkdirSync(path.dirname(annotationsPath), { recursive: true });
    fs.appendFileSync(
      annotationsPath,
      `${issuesToAnnotations(codeFindings).join('\n')}\n`,
      'utf8',
    );
  }

  let errorCount = 0;
  let warningCount = 0;
  for (const issue of codeFindings) {
    const sev = (issue.severity ?? '').toUpperCase();
    if (sev === 'HIGH' || sev === 'CRITICAL') errorCount+=1;
    else if (sev === 'MEDIUM' || sev === 'WARNING') warningCount+=1;
  }
  // docFindings are informational; count them separately so the
  // summary can show "N doc-policy findings" alongside the actionable
  // code findings.
  let docErrorCount = 0;
  let docWarningCount = 0;
  for (const issue of docFindings) {
    const sev = (issue.severity ?? '').toUpperCase();
    if (sev === 'HIGH' || sev === 'CRITICAL') docErrorCount+=1;
    else if (sev === 'MEDIUM' || sev === 'WARNING') docWarningCount+=1;
  }

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
    fs.writeFileSync(resolvedSarif, `${JSON.stringify(merged, null, 2)}\n`);
  }

  console.log(`  findings=${issues.length} errors=${errorCount} warnings=${warningCount} ss_exit=${result.exitCode}`);
  console.log('::endgroup::');

  // Write per-skill findings to a JSON file consumed by the workflow's
  // step summary builder. The workflow assembles these into a tree-
  // style Markdown report.  Each file is named with a counter to
  // preserve insertion order and avoid parallel-write races.
  // Default to a tmp dir shared with build-step-summary.mjs, which reads the
  // findings JSONs in the workflow's `Write step summary` step. CI-only,
  // ephemeral, mode-restricted; suppress S5443 for the literal /tmp path.
  const summaryDir = '/tmp/ss-findings'; // NOSONAR
  const findingsFile = process.env.SS_FINDINGS_DIR || process.env.FINDINGS_DIR || summaryDir;
  if (findingsFile) {
    fs.mkdirSync(findingsFile, { recursive: true, mode: 0o700 });
    const entries = issues.map((issue) => {
      const sev = (issue.severity ?? '').toUpperCase();
      const loc = issue.location;
      const filePath = loc?.file ?? '?';
      const line = loc?.start_line ?? '?';
      const ruleId = issue.id ?? '?';
      const msg = (issue.explanation ?? '').split('\n')[0]?.slice(0, 200) ?? '';
      let level: string;
      if (sev === 'HIGH' || sev === 'CRITICAL') level = 'error';
      else if (sev === 'MEDIUM' || sev === 'WARNING') level = 'warning';
      else level = 'info';
      return { ruleId, level, filePath, line, msg };
    });
    const payload = JSON.stringify({
      skill: skillName,
      errors: errorCount + docErrorCount,
      warnings: warningCount + docWarningCount,
      findings: entries,
    });
    // Use an atomic create-and-write with a sequential fallback so
    // parallel executor processes do not overwrite the same filename.
    // `flag: 'wx'` fails with EEXIST if another process won the race.
    let idx = fs.readdirSync(findingsFile).filter((f) => f.endsWith('.json')).length + 1;
    const maxAttempts = idx + 9999;
    while (idx < maxAttempts) {
      const candidate = path.join(findingsFile, `${String(idx).padStart(4, '0')}.json`);
      try {
        fs.writeFileSync(candidate, payload, { flag: 'wx', encoding: 'utf8' });
        break;
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === 'EEXIST') {
          idx+=1;
          continue;
        }
        throw err;
      }
    }
    if (idx >= maxAttempts) {
      throw new Error(
        `SkillSpector could not write findings file for ${skillName}: all candidate filenames from ${maxAttempts - 9999} to ${maxAttempts - 1} were in use.`,
      );
    }
  }

  return { success: !failOnError || errorCount === 0 };
}

export type ScanExecutorOptions = {
  path: string;
  sarif?: string;
  annotations?: boolean;
  failOnError?: boolean;
  jobSummary?: boolean;
  noLlM?: boolean;
  baseline?: string;
};