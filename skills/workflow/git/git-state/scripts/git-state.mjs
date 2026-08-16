#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    format: { type: 'string', default: 'markdown' },
    refresh: { type: 'boolean', default: false },
    repository: { type: 'string', default: process.cwd() },
  },
  strict: true,
});

if (!['json', 'markdown'].includes(values.format)) {
  throw new Error('--format must be markdown or json');
}

const cwd = values.repository;

function git(args, allowFailure = false) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
  } catch (error) {
    if (allowFailure) return undefined;
    const stderr = error.stderr?.toString().trim();
    throw new Error(stderr || `git ${args.join(' ')} failed`);
  }
}

function defaultBase() {
  const remoteHead = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'], true);
  if (!remoteHead) {
    throw new Error('cannot determine default branch; pass --base origin/<branch>');
  }
  return remoteHead.replace(/^refs\/remotes\//, '');
}

function branchName(base) {
  const match = base.match(/^origin\/(.+)$/);
  if (!match) throw new Error('--refresh requires a base in the form origin/<branch>');
  return match[1];
}

function parseWorktrees(text) {
  return text.split('\n\n').filter(Boolean).map((block) => {
    const fields = Object.fromEntries(block.split('\n').map((line) => {
      const [key, ...rest] = line.split(' ');
      return [key, rest.join(' ')];
    }));
    return {
      path: fields.worktree,
      head: fields.HEAD,
      branch: fields.branch?.replace('refs/heads/', ''),
      prunable: Boolean(fields.prunable),
    };
  });
}

function parseBranches(text, base) {
  // Git appends a newline after every formatted ref. NUL separates fields;
  // remove only those record-newlines so an empty upstream remains a field.
  const fields = text.split('\0').map((field) => field.replaceAll('\n', ''));
  const branches = [];
  for (let index = 0; index < fields.length; index += 2) {
    const name = fields[index];
    if (!name) continue;
    const upstream = fields[index + 1] || undefined;
    const [behind, ahead] = git(['rev-list', '--left-right', '--count', `${base}...${name}`])
      .trim()
      .split(/\s+/)
      .map(Number);
    branches.push({ name, upstream, ahead, behind, merged: ahead === 0 });
  }
  return branches;
}

function markdown(report) {
  const escape = (value) => String(value ?? '—').replaceAll('|', '\\|');
  const lines = [
    `Comparison base: \`${report.base}\``,
    '',
    '| Branch | Upstream | Relative to base |',
    '|---|---|---:|',
  ];
  for (const branch of report.branches) {
    const marker = branch.ahead === 0 ? '🟢' : '🟡';
    lines.push(`| \`${escape(branch.name)}\` | \`${escape(branch.upstream)}\` | ${marker} ↑${branch.ahead} ↓${branch.behind} |`);
  }
  lines.push('', `Working tree: ${report.dirty ? `🟡 ${report.changedPaths.length} changed path(s)` : '🟢 clean'}`);
  lines.push(`Worktrees: ${report.worktrees.length}; prunable metadata: ${report.worktrees.filter((worktree) => worktree.prunable).length}`);
  return lines.join('\n');
}

const base = values.base ?? defaultBase();
if (values.refresh) git(['fetch', 'origin', branchName(base)]);
git(['rev-parse', '--verify', '--quiet', base]);

const status = git(['status', '--porcelain=v1', '--branch']);
const changedPaths = status.split('\n').filter((line) => line && !line.startsWith('##')).map((line) => line.slice(3));
const report = {
  base,
  branches: parseBranches(git(['for-each-ref', '--format=%(refname:short)%00%(upstream:short)%00', 'refs/heads']), base),
  changedPaths,
  dirty: changedPaths.length > 0,
  worktrees: parseWorktrees(git(['worktree', 'list', '--porcelain'])),
};

console.log(values.format === 'json' ? JSON.stringify(report, null, 2) : markdown(report));
