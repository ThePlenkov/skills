import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = mkdtempSync(join(tmpdir(), 'git-repository-landscape-'));
const script = resolve(fileURLToPath(new URL('.', import.meta.url)), 'git-repository-landscape.mjs');

function git(args) {
  execFileSync('git', args, { cwd: root, stdio: 'ignore' });
}

try {
  git(['init', '--initial-branch=main']);
  git(['config', 'user.email', 'skill@example.test']);
  git(['config', 'user.name', 'Skill Test']);
  writeFileSync(join(root, 'README.md'), 'base\n');
  git(['add', 'README.md']);
  git(['commit', '-m', 'base']);
  git(['switch', '-c', 'feature/landscape']);
  writeFileSync(join(root, 'feature.txt'), 'feature\n');
  git(['add', 'feature.txt']);
  git(['commit', '-m', 'feature']);

  const output = execFileSync('node', [script, '--repository', root, '--base', 'main', '--format', 'json'], { encoding: 'utf8' });
  const report = JSON.parse(output);
  const feature = report.branches.find((branch) => branch.name === 'feature/landscape');
  assert.deepEqual(feature, { name: 'feature/landscape', ahead: 1, behind: 0, merged: false });
  assert.equal(report.branches.some((branch) => branch.name === ''), false);
  assert.equal(report.dirty, false);
} finally {
  rmSync(root, { recursive: true, force: true });
}
