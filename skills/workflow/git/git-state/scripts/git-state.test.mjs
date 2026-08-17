import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = resolve(fileURLToPath(new URL('.', import.meta.url)), 'git-state.mjs');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function run(repository, args = []) {
  return execFileSync('node', [script, '--repository', repository, ...args], { encoding: 'utf8' });
}

const root = mkdtempSync(join(tmpdir(), 'git-state-'));
try {
  const repository = join(root, 'repository');
  git(['init', '--initial-branch=main', repository], root);
  git(['config', 'user.email', 'skill@example.test'], repository);
  git(['config', 'user.name', 'Skill Test'], repository);
  writeFileSync(join(repository, 'README.md'), 'base\n');
  git(['add', 'README.md'], repository);
  git(['commit', '-m', 'base'], repository);
  git(['switch', '-c', 'feature/landscape'], repository);
  writeFileSync(join(repository, 'feature.txt'), 'feature\n');
  git(['add', 'feature.txt'], repository);
  git(['commit', '-m', 'feature'], repository);
  writeFileSync(join(repository, 'changed.txt'), 'changed\n');
  const linkedWorktree = join(root, 'linked-worktree');
  git(['worktree', 'add', '-b', 'worktree/example', linkedWorktree, 'main'], repository);

  const jsonReport = JSON.parse(run(repository, ['--base', 'main', '--format', 'json']));
  const feature = jsonReport.branches.find((branch) => branch.name === 'feature/landscape');
  assert.deepEqual(feature, { name: 'feature/landscape', ahead: 1, behind: 0, containedInBase: false });
  assert.equal(jsonReport.branches.some((branch) => branch.name === ''), false);
  assert.deepEqual(jsonReport.changedPaths, ['changed.txt']);
  assert.equal(jsonReport.dirty, true);
  assert.equal(jsonReport.worktrees.length, 2);
  assert.deepEqual(jsonReport.worktrees.map(({ branch, current, prunable }) => ({ branch, current, prunable })), [
    { branch: 'feature/landscape', current: true, prunable: false },
    { branch: 'worktree/example', current: false, prunable: false },
  ]);

  const markdownReport = run(repository, ['--base', 'main']);
  assert.match(markdownReport, /Changed paths:\n- `changed\.txt`/);
  assert.match(markdownReport, /\| `[^|]+repository` \| `feature\/landscape` \| yes \| no \|/);
  assert.match(markdownReport, /\| `[^|]+linked-worktree` \| `worktree\/example` \| no \| no \|/);

  const remote = join(root, 'remote.git');
  git(['init', '--bare', remote], root);
  git(['remote', 'add', 'origin', remote], repository);
  git(['push', '-u', 'origin', 'main'], repository);
  git(['symbolic-ref', 'HEAD', 'refs/heads/main'], remote);
  const clone = join(root, 'clone');
  git(['clone', remote, clone], root);
  git(['config', 'user.email', 'skill@example.test'], clone);
  git(['config', 'user.name', 'Skill Test'], clone);
  git(['remote', 'set-head', 'origin', '-a'], clone);
  git(['switch', '-c', 'feature/default-base'], clone);
  writeFileSync(join(clone, 'default-base.txt'), 'feature\n');
  git(['add', 'default-base.txt'], clone);
  git(['commit', '-m', 'default-base feature'], clone);
  git(['push', '-u', 'origin', 'feature/default-base'], clone);

  const defaultBaseReport = JSON.parse(run(clone, ['--format', 'json', '--refresh']));
  assert.equal(defaultBaseReport.base, 'origin/main');
  const clonedFeature = defaultBaseReport.branches.find((branch) => branch.name === 'feature/default-base');
  assert.equal(clonedFeature.upstream, 'origin/feature/default-base');
  assert.equal(clonedFeature.ahead, 1);
  assert.equal(clonedFeature.containedInBase, false);
} finally {
  rmSync(root, { recursive: true, force: true });
}
