#!/usr/bin/env node
/**
 * git-prune — delete stale local branches.
 *
 * Reuses $skill{git-status} for the branch facts. A branch is a prune candidate
 * when it is BEHIND the comparison base AND NOT AHEAD (no unique commits), or
 * when its upstream is gone. The current branch and any branch with uncommitted
 * changes are never pruned.
 *
 * This script is dry-run by default. Pass --apply to actually delete. The
 * $skill{git-prune} SKILL.md mandates $skill{safeguard} before --apply.
 *
 * Run with modern Node (>= 22.6) native TypeScript:
 *   node --experimental-strip-types scripts/git-prune.ts --repository <path>
 *
 * Options:
 *   --repository <path>   repository to prune (default: cwd)
 *   --base <ref>          comparison base, e.g. origin/main (default: origin/HEAD)
 *   --refresh             fetch the base branch before analysing
 *   --apply               delete candidates (default: dry-run, list only)
 *   --prune-remotes       also run `git remote prune origin` for gone upstreams
 *   --no-color            plain output
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    refresh: { type: 'boolean', default: false },
    repository: { type: 'string', default: process.cwd() },
    apply: { type: 'boolean', default: false },
    'safeguard-approved': { type: 'boolean', default: false },
    'prune-remotes': { type: 'boolean', default: false },
    'no-color': { type: 'boolean', default: false },
  },
  strict: true,
});

const color = !values['no-color'] && process.stdout.isTTY === true;
const cwd = resolve(values.repository);
const here = dirname(fileURLToPath(import.meta.url));
const gitStatusScript = resolve(here, '..', '..', 'git-status', 'scripts', 'git-status.ts');

interface BranchRow {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  insertions: number;
  deletions: number;
  gone: boolean;
  current: boolean;
  status: string;
}

function git(args: string[], allowFailure = false): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
  } catch (error) {
    if (allowFailure) return '';
    const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(stderr || `git ${args.join(' ')} failed`);
  }
}

// Reuse git-status for the canonical branch facts.
const statusArgs = ['--experimental-strip-types', gitStatusScript, '--repository', cwd, '--format', 'json'];
if (values.base) statusArgs.push('--base', values.base);
if (values.refresh) statusArgs.push('--refresh');
const statusResult = spawnSync('node', statusArgs, { encoding: 'utf8' });
if (statusResult.status !== 0) {
  throw new Error(statusResult.stderr?.trim() || 'git-status failed');
}
const { base, branches } = JSON.parse(statusResult.stdout) as { base: string; branches: BranchRow[] };

const workingTreeClean = git(['status', '--porcelain']).length === 0;

// Candidate: behind base, not ahead, no unique work. Gone-upstream branches with
// no unique commits are also candidates. Never the current branch.
const candidates = branches.filter((b) => {
  if (b.current) return false;
  if (b.ahead > 0) return false; // has unique commits — keep
  if (b.behind === 0 && !b.gone) return false; // in sync, nothing to prune
  return b.behind > 0 || b.gone;
});

const c = (code: string, text: string) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
const dim = (t: string) => c('2', t);
const bold = (t: string) => c('1', t);
const red = (t: string) => c('31', t);
const green = (t: string) => c('32', t);
const yellow = (t: string) => c('33', t);

console.log(bold('git-prune') + dim(`  (base: ${base})  mode: ${values.apply ? red('APPLY') : 'dry-run'}`));
if (!workingTreeClean) {
  console.log(yellow('⚠ working tree is dirty; current branch will not be pruned regardless'));
}
console.log();

if (candidates.length === 0) {
  console.log(green('No stale branches to prune.'));
} else {
  for (const b of candidates) {
    const reason = b.gone ? 'upstream gone' : `behind ${b.behind}, ahead 0`;
    console.log(`  ${b.symbol ?? '🔻'} ${b.branch.padEnd(32)} ${dim(reason)}`);
  }
  console.log();
  console.log(dim(`${candidates.length} candidate(s).`));
}

if (values.apply) {
  if (!values['safeguard-approved']) {
    console.log(red('ERROR: --apply requires --safeguard-approved.'));
    console.log(dim('Run $skill{safeguard} first, then pass --safeguard-approved to confirm approval.'));
    process.exit(1);
  }
  if (!workingTreeClean) {
    console.log(red('ERROR: working tree is dirty; refusing --apply.'));
    console.log(dim('Commit or stash changes first. A clean worktree is required before pruning.'));
    process.exit(1);
  }
  let deleted = 0;
  let failed = 0;
  for (const b of candidates) {
    // -d refuses to delete branches not fully merged into their upstream
    // (or into HEAD when upstream is gone) — a second safety net.
    const r = spawnSync('git', ['branch', '-d', b.branch], { cwd, encoding: 'utf8' });
    if (r.status === 0) {
      console.log(green(`  deleted ${b.branch}`));
      deleted++;
    } else {
      console.log(red(`  FAILED ${b.branch}: ${r.stderr?.trim() || 'unknown'}`));
      failed++;
    }
  }
  if (values['prune-remotes']) {
    const r = spawnSync('git', ['remote', 'prune', 'origin'], { cwd, encoding: 'utf8' });
    if (r.status === 0) {
      console.log(green('  pruned stale remote-tracking refs for origin'));
    } else {
      console.log(red(`  remote prune FAILED: ${r.stderr?.trim() || 'unknown'}`));
    }
  }
  console.log();
  console.log(bold(`Pruned ${deleted}, failed ${failed}.`));
} else if (candidates.length > 0) {
  console.log();
  console.log(dim('Dry-run only. Re-run with --apply to delete. $skill{safeguard} is required before --apply.'));
}
