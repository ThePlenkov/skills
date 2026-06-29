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

  // Rewrite each issue's location.file to a workspace-relative path
  // before building annotations. Skillspector returns paths relative
  // to its scan root (e.g. `SKILL.md`, `references/foo.md`); GitHub
  // workflow commands interpret `file=` as a repo-relative path. If
  // we emit `file=SKILL.md` directly, GitHub can't resolve it (no
  // `SKILL.md` at the repo root) and falls back to `.github`, which
  // is why so many check-run annotations point at `.github` instead
  // of the actual file. Joining with the scan root fixes this.
  const skillRootAbs = path.resolve(resolvedPath);
  for (const issue of issues) {
    const loc = issue.location;
    if (!loc?.file) continue;
    if (path.isAbsolute(loc.file)) continue;
    const absolute = path.resolve(skillRootAbs, loc.file);
    loc.file = path.relative(context.root, absolute);
  }

  if (annotations) {
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
      issuesToAnnotations(issues).join('\n') + '\n',
      'utf8',
    );
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

  // Append per-skill findings as Markdown table rows to a shared
  // file. The workflow's outer step builds the final comment body
  // by combining these rows with a totals summary, then posts it
  // to the PR Conversation tab as an idempotent comment.
  //
  // Nx runs the executor in parallel (one invocation per skill),
  // so all 43 invocations append to the same file. We use a
  // header sentinel on the first writer so the header is only
  // written once; subsequent invocations just append rows.
  const summaryPath = process.env.PR_SUMMARY_FILE;
  if (summaryPath) {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    if (!fs.existsSync(summaryPath)) {
      fs.writeFileSync(
        summaryPath,
        [
          '<!-- SkillSpector:start -->',
          '<!-- SkillSpector:rows -->',
          '| Skill | File | Line | Severity | Rule | Summary |',
          '| :--- | :--- | ---: | :--- | :--- | :--- |',
          '',
        ].join('\n'),
        'utf8',
      );
    }
    const rows: string[] = [];
    for (const issue of issues) {
      const sev = (issue.severity ?? '').toUpperCase();
      const sevBadge =
        sev === 'HIGH' || sev === 'CRITICAL' ? '❌ error'
        : sev === 'MEDIUM' || sev === 'WARNING' ? '⚠️ warning'
        : sev === 'LOW' || sev === 'INFO' ? 'ℹ️ note'
        : '· ' + sev.toLowerCase();
      const loc = issue.location;
      const filePath = loc?.file ?? '?';
      const line = loc?.start_line ?? '?';
      const ruleId = issue.id ?? '?';
      // First line of the explanation as a compact summary; the
      // full text is available in the SARIF / workflow-command
      // annotations.
      const msg = (issue.explanation ?? '').split('\n')[0]?.slice(0, 200) ?? '';
      const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      rows.push(
        `| ${esc(skillName)} | ${esc(filePath)} | ${line} | ${sevBadge} | ${esc(ruleId)} | ${esc(msg)} |`,
      );
    }
    if (rows.length) fs.appendFileSync(summaryPath, rows.join('\n') + '\n', 'utf8');
  }

  return { success: !failOnError || errorCount === 0 };
}