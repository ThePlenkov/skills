#!/usr/bin/env node
/**
 * git-status — read-only branch dashboard.
 *
 * Lists every local and remote-tracking branch with ahead/behind counts,
 * diff insertions/deletions vs the comparison base, upstream tracking status,
 * and a UI-friendly symbol/colour summary. Never mutates the repository.
 *
 * Run with modern Node (>= 22.6) native TypeScript:
 *   node --experimental-strip-types scripts/git-status.ts --repository <path>
 *
 * Output:
 *   --format markdown (default)  pretty coloured table
 *   --format json                machine-readable, consumed by git-prune
 *   --format plain               no colour codes (CI logs, piped output)
 *
 * Options:
 *   --repository <path>   repository to inspect (default: cwd)
 *   --base <ref>          comparison base, e.g. origin/main (default: origin/HEAD)
 *   --refresh             fetch only the base branch before analysing
 *   --include-remotes     list origin/* remote-tracking branches too (off by default)
 *   --no-color            force plain output (alias for --format plain)
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    format: { type: 'string', default: 'markdown' },
    refresh: { type: 'boolean', default: false },
    repository: { type: 'string', default: process.cwd() },
    'include-remotes': { type: 'boolean', default: false },
    'no-color': { type: 'boolean', default: false },
  },
  strict: true,
});

if (!['markdown', 'json', 'plain'].includes(values.format)) {
  throw new Error('--format must be markdown, json, or plain');
}

const color = !values['no-color'] && values.format !== 'plain' && process.stdout.isTTY === true;
const cwd = resolve(values.repository);

function git(args: string[], allowFailure = false): string | undefined {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
  } catch (error) {
    if (allowFailure) return undefined;
    const stderr = (error as { stderr?: Buffer }).stderr?.toString().trim();
    throw new Error(stderr || `git ${args.join(' ')} failed`);
  }
}

function defaultBase(): string {
  const remoteHead = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'], true);
  if (!remoteHead) {
    throw new Error('cannot determine default branch; pass --base origin/<branch>');
  }
  return remoteHead.replace(/^refs\/remotes\//, '');
}

const base = values.base ?? defaultBase();
const baseBranch = base.replace(/^origin\//, '');

// When --refresh is set, fetch the base first so a remote base that doesn't
// exist locally yet (e.g. origin/released created after clone) is established
// before validation.
if (values.refresh) {
  git(['fetch', 'origin', baseBranch, '--quiet']);
}

// Validate the base ref exists so an invalid --base doesn't silently produce
// zero counts and mislabel every branch as in sync.
if (git(['rev-parse', '--verify', base], true) === undefined) {
  throw new Error(`comparison base '${base}' does not exist; pass --base origin/<branch>`);
}

interface BranchRow {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  insertions: number;
  deletions: number;
  gone: boolean;
  current: boolean;
  lastCommit: string;
  symbol: string;
  status: 'sync' | 'ahead' | 'behind' | 'diverged' | 'gone' | 'no-upstream';
}

function countChanges(rev: string): { insertions: number; deletions: number } {
  // base..rev = what the branch adds/changes relative to base (the branch's own work).
  const out = git(['diff', '--numstat', `${base}..${rev}`], true);
  if (!out) return { insertions: 0, deletions: 0 };
  let insertions = 0;
  let deletions = 0;
  for (const line of out.split('\n')) {
    if (!line) continue;
    const [add, del] = line.split('\t');
    if (add !== '-' && add !== undefined) insertions += Number(add) || 0;
    if (del !== '-' && del !== undefined) deletions += Number(del) || 0;
  }
  return { insertions, deletions };
}

function aheadBehind(rev: string): { ahead: number; behind: number } {
  const out = git(['rev-list', '--left-right', '--count', `${rev}...${base}`], true);
  if (!out) return { ahead: 0, behind: 0 };
  // --left-right with `A...B` prints `<left> <right>`: left = commits in A not in B
  // (ahead, unique to the branch), right = commits in B not in A (behind, on base).
  const [ahead, behind] = out.split(/\s+/).map(Number);
  return { ahead: ahead || 0, behind: behind || 0 };
}

function classify(row: { ahead: number; behind: number; gone: boolean; upstream: string | null }): {
  symbol: string;
  status: BranchRow['status'];
} {
  if (!row.upstream) return { symbol: '⚪', status: 'no-upstream' };
  if (row.gone) return { symbol: '🔴', status: 'gone' };
  if (row.ahead === 0 && row.behind === 0) return { symbol: '🟢', status: 'sync' };
  if (row.ahead > 0 && row.behind === 0) return { symbol: '🟡', status: 'ahead' };
  if (row.ahead === 0 && row.behind > 0) return { symbol: '🔻', status: 'behind' };
  return { symbol: '🟠', status: 'diverged' };
}

const currentBranch = git(['rev-parse', '--abbrev-ref', 'HEAD'], true) ?? 'HEAD';
const localBranches = (git(['for-each-ref', '--format=%(refname:short)', 'refs/heads/'], true) ?? '')
  .split('\n')
  .filter(Boolean);

const remoteBranches = values['include-remotes']
  ? (git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/'], true) ?? '')
      .split('\n')
      .filter((b) => b !== 'origin/HEAD' && !b.endsWith('/HEAD'))
  : [];

const rows: BranchRow[] = [];

for (const branch of localBranches) {
  const upstream = git(['for-each-ref', `--format=%(upstream:short)`, `refs/heads/${branch}`], true) || null;
  const gone = upstream !== null && git(['rev-parse', '--verify', upstream], true) === undefined;
  const rev = `refs/heads/${branch}`;
  const { ahead, behind } = aheadBehind(rev);
  const { insertions, deletions } = countChanges(rev);
  const lastCommit = git(['log', '-1', '--format=%cr', rev], true) ?? 'unknown';
  const { symbol, status } = classify({ ahead, behind, gone, upstream });
  rows.push({
    branch,
    upstream,
    ahead,
    behind,
    insertions,
    deletions,
    gone,
    current: branch === currentBranch,
    lastCommit,
    symbol,
    status,
  });
}

for (const ref of remoteBranches) {
  const branch = ref; // origin/foo
  const { ahead, behind } = aheadBehind(ref);
  const { insertions, deletions } = countChanges(ref);
  const lastCommit = git(['log', '-1', '--format=%cr', ref], true) ?? 'unknown';
  rows.push({
    branch,
    upstream: branch,
    ahead,
    behind,
    insertions,
    deletions,
    gone: false,
    current: false,
    lastCommit,
    symbol: '🌐',
    status: 'sync',
  });
}

if (values.format === 'json') {
  console.log(JSON.stringify({ base, branches: rows }, null, 2));
} else {
  const c = (code: string, text: string) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
  const dim = (t: string) => c('2', t);
  const bold = (t: string) => c('1', t);
  const green = (t: string) => c('32', t);
  const red = (t: string) => c('31', t);
  const yellow = (t: string) => c('33', t);

  console.log(bold(`Git branch dashboard`) + dim(`  (base: ${base})`));
  console.log();

  const header = ['Branch', 'Upstream', 'vs base', 'Diff', 'Last commit', ''];
  const rowsStr = rows.map((r) => {
    const branch = r.current ? `${green('*')} ${r.branch}` : `  ${r.branch}`;
    const upstream = r.upstream ?? dim('(none)');
    const vs = `${r.ahead > 0 ? yellow(`↑${r.ahead}`) : dim('↑0')} ${r.behind > 0 ? red(`↓${r.behind}`) : dim('↓0')}`;
    const diff = `${green(`+${r.insertions}`)} ${red(`-${r.deletions}`)}`;
    return [branch, upstream, vs, diff, dim(r.lastCommit), r.symbol];
  });

  const all = [header, ...rowsStr];
  const widths = header.map((_, i) => Math.max(...all.map((row) => String(row[i]).replace(/\x1b\[[0-9;]*m/g, '').length)));
  for (const row of all) {
    console.log(
      row
        .map((cell, i) => {
          const plain = String(cell).replace(/\x1b\[[0-9;]*m/g, '');
          const pad = ' '.repeat(Math.max(0, widths[i] - plain.length));
          return i === row.length - 1 ? cell : cell + pad;
        })
        .join('  '),
    );
  }

  console.log();
  console.log(dim('Legend: 🟢 in sync  🟡 ahead only  🔻 behind only  🟠 diverged  🔴 upstream gone  ⚪ no upstream  🌐 remote-tracking'));
}
