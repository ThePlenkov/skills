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

const execFileP = promisify(execFile);

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
      issuesToAnnotations(codeFindings).join('\n') + '\n',
      'utf8',
    );
  }

  let errorCount = 0;
  let warningCount = 0;
  for (const issue of codeFindings) {
    const sev = (issue.severity ?? '').toUpperCase();
    if (sev === 'HIGH' || sev === 'CRITICAL') errorCount++;
    else if (sev === 'MEDIUM' || sev === 'WARNING') warningCount++;
  }
  // docFindings are informational; count them separately so the
  // summary can show "N doc-policy findings" alongside the actionable
  // code findings.
  let docErrorCount = 0;
  let docWarningCount = 0;
  for (const issue of docFindings) {
    const sev = (issue.severity ?? '').toUpperCase();
    if (sev === 'HIGH' || sev === 'CRITICAL') docErrorCount++;
    else if (sev === 'MEDIUM' || sev === 'WARNING') docWarningCount++;
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
    fs.writeFileSync(resolvedSarif, JSON.stringify(merged, null, 2) + '\n');
  }

  console.log(`  findings=${issues.length} errors=${errorCount} warnings=${warningCount} ss_exit=${result.exitCode}`);
  console.log('::endgroup::');

  if (jobSummary && process.env.GITHUB_STEP_SUMMARY) {
    // Per-skill block in the step summary. The outer workflow step
    // adds a header/totals above this; each executor invocation
    // appends its own block. Format kept terse — the rich design
    // lives in the consolidated summary built by the workflow step.
    const totalFindings = issues.length;
    const allErrors = errorCount + docErrorCount;
    const allWarnings = warningCount + docWarningCount;
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '',
        `### ${skillName}`,
        '',
        `| Severity (code) | Severity (docs) | Total |`,
        `| :--- | :--- | ---: |`,
        `| ❌ ${errorCount} errors / ⚠️ ${warningCount} warnings | ❌ ${docErrorCount} / ⚠️ ${docWarningCount} | ${totalFindings} |`,
        '',
      ].join('\n'),
    );
  }

  // Append per-skill findings as Markdown table rows to a shared
  // file. The workflow's outer step builds the final PR comment body
  // from this — kept minimal (just totals + a link to the run),
  // because the rich content lives in the step summary, not the PR.
  const summaryPath = process.env.PR_SUMMARY_FILE;
  if (summaryPath) {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    if (!fs.existsSync(summaryPath)) {
      fs.writeFileSync(
        summaryPath,
        [
          '<!-- SkillSpector:rows -->',
          '| Skill | Code errors | Code warnings | Doc findings |',
          '| :--- | ---: | ---: | ---: |',
          '',
        ].join('\n'),
        'utf8',
      );
    }
    const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const row = `| ${esc(skillName)} | ${errorCount} | ${warningCount} | ${docFindings.length + docErrorCount + docWarningCount} |`;
    fs.appendFileSync(summaryPath, row + '\n', 'utf8');
  }

  return { success: !failOnError || errorCount === 0 };
}

async function runSkillspector(opts: {
  bin: string;
  path: string;
  noLlM: boolean;
  baseline?: string;
}): Promise<{ exitCode: number; jsonText: string }> {
  try {
    const args = ['scan', opts.path, '--format', 'json'];
    if (opts.noLlM) args.push('--no-llm');
    if (opts.baseline) {
      args.push('--baseline', opts.baseline);
    }
    const { stdout, stderr } = await execFileP(opts.bin, args, {
      maxBuffer: 200 * 1024 * 1024,
    });
    if (stderr) process.stderr.write(stderr);
    return { exitCode: 0, jsonText: stdout };
  } catch (err: unknown) {
    // execFile rejects on non-zero exit. Skillspector exits non-zero
    // when findings exist, but still writes JSON to stdout.
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      exitCode: typeof e.code === 'number' ? e.code : 1,
      jsonText: e.stdout ?? '',
    };
  }
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