import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = resolve(fileURLToPath(new URL('.', import.meta.url)), 'git-prune.ts');

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function run(repository: string, args: string[]): string {
  return execFileSync('node', ['--experimental-strip-types', script, '--repository', repository, ...args], {
    encoding: 'utf8',
  });
}

const root = mkdtempSync(join(tmpdir(), 'git-prune-'));
try {
  const repository = join(root, 'repository');
  git(['init', '--initial-branch=main', repository], root);
  git(['config', 'user.email', 'skill@example.test'], repository);
  git(['config', 'user.name', 'Skill Test'], repository);
  writeFileSync(join(repository, 'README.md'), 'base\n');
  git(['add', 'README.md'], repository);
  git(['commit', '-m', 'base'], repository);
  // advance main
  writeFileSync(join(repository, 'main2.txt'), 'main2\n');
  git(['add', 'main2.txt'], repository);
  git(['commit', '-m', 'main2'], repository);
  // keep branch: ahead 1 (must NOT be pruned)
  git(['switch', '-c', 'keep/ahead'], repository);
  writeFileSync(join(repository, 'keep.txt'), 'keep\n');
  git(['add', 'keep.txt'], repository);
  git(['commit', '-m', 'keep'], repository);
  git(['switch', 'main'], repository);
  // stale branch: behind 1, ahead 0 (candidate)
  git(['switch', '-c', 'stale/behind', 'main~1'], repository);
  git(['switch', 'main'], repository);

  // Dry-run: lists stale/behind, does NOT list keep/ahead, does not delete
  const dry = run(repository, ['--base', 'main', '--no-color']);
  assert.match(dry, /stale\/behind/);
  assert.doesNotMatch(dry, /keep\/ahead/);
  assert.match(dry, /dry-run/);
  assert.doesNotMatch(dry, /deleted stale\/behind/);
  // stale/behind still exists
  assert.ok(git(['rev-parse', '--verify', 'refs/heads/stale/behind'], repository));

  // Apply: deletes stale/behind, keeps keep/ahead
  const applied = run(repository, ['--base', 'main', '--apply', '--safeguard-approved', '--no-color']);
  assert.match(applied, /deleted stale\/behind/);
  assert.throws(() => git(['rev-parse', '--verify', 'refs/heads/stale/behind'], repository), /Needed a single revision/);
  assert.ok(git(['rev-parse', '--verify', 'refs/heads/keep/ahead'], repository));

  console.log('git-prune.test.ts: all assertions passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
