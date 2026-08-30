import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = resolve(fileURLToPath(new URL('.', import.meta.url)), 'git-status.ts');

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function run(repository: string, args: string[] = []): string {
  return execFileSync('node', ['--experimental-strip-types', script, '--repository', repository, ...args], {
    encoding: 'utf8',
  });
}

const root = mkdtempSync(join(tmpdir(), 'git-status-'));
try {
  const repository = join(root, 'repository');
  git(['init', '--initial-branch=main', repository], root);
  git(['config', 'user.email', 'skill@example.test'], repository);
  git(['config', 'user.name', 'Skill Test'], repository);
  writeFileSync(join(repository, 'README.md'), 'base\n');
  git(['add', 'README.md'], repository);
  git(['commit', '-m', 'base'], repository);

  // advance main so later branches can be "behind" it
  writeFileSync(join(repository, 'main2.txt'), 'main2\n');
  git(['add', 'main2.txt'], repository);
  git(['commit', '-m', 'main2'], repository);

  // feature branch: branched from current main, +1 commit → ahead 1, behind 0
  git(['switch', '-c', 'feature/ahead'], repository);
  writeFileSync(join(repository, 'feature.txt'), 'feature\n');
  git(['add', 'feature.txt'], repository);
  git(['commit', '-m', 'feature'], repository);

  // stale branch: branched from main~1 (before main2) → behind 1, ahead 0
  git(['switch', 'main'], repository);
  git(['switch', '-c', 'stale/behind', 'main~1'], repository);

  // JSON output
  const json = run(repository, ['--format', 'json', '--base', 'main']);
  const parsed = JSON.parse(json) as {
    base: string;
    branches: { branch: string; ahead: number; behind: number; insertions: number; deletions: number }[];
  };
  assert.equal(parsed.base, 'main');
  const ahead = parsed.branches.find((b) => b.branch === 'feature/ahead');
  assert.ok(ahead, 'feature/ahead present');
  assert.equal(ahead!.ahead, 1, 'feature/ahead is ahead by 1');
  assert.equal(ahead!.behind, 0, 'feature/ahead is behind 0');
  assert.ok(ahead!.insertions > 0, 'feature/ahead has insertions');
  const stale = parsed.branches.find((b) => b.branch === 'stale/behind');
  assert.ok(stale, 'stale/behind present');
  assert.equal(stale!.ahead, 0, 'stale/behind is ahead 0');
  assert.equal(stale!.behind, 1, 'stale/behind is behind 1');

  // Markdown output contains symbols and base header
  const md = run(repository, ['--format', 'markdown', '--base', 'main']);
  assert.match(md, /base: main/);
  assert.match(md, /feature\/ahead/);
  assert.match(md, /stale\/behind/);

  console.log('git-status.test.ts: all assertions passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
