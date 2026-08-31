#!/usr/bin/env node
// Start a self-hosted GitHub Actions runner for the repo/PR being acted on.
// Cross-platform: Linux, macOS, Windows. Requires `gh` and `node`.
// This file uses `.cjs` because the repository sets `"type": "module"`.

const { execFileSync, spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function parseArgs(argv) {
  const args = {
    labels: '',
    persistent: false,
    ephemeral: true,
    detach: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--owner') { args.owner = next; i++; }
    else if (key === '--repo') { args.repo = next; i++; }
    else if (key === '--token') { args.token = next; i++; }
    else if (key === '--work-dir') { args.workDir = next; i++; }
    else if (key === '--labels') { args.labels = next; i++; }
    else if (key === '--pid-file') { args.pidFile = next; i++; }
    else if (key === '--persistent') { args.persistent = true; args.ephemeral = false; }
    else if (key === '--ephemeral') { args.ephemeral = true; args.persistent = false; }
    else if (key === '--detach' || key === '--daemon') { args.detach = true; }
    else if (key === '--help' || key === '-h') { args.help = true; }
    else { throw new Error(`Unknown argument: ${key}`); }
  }
  return args;
}

const args = parseArgs(process.argv);

if (args.help) {
  console.log(`Usage: node runner.cjs --owner <owner> --repo <repo> --token <token> [options]

Options:
  --owner <owner>      Repository owner (or OWNER env var)
  --repo <repo>        Repository name (or REPO env var)
  --token <token>      Runner registration token (or RUNNER_TOKEN env var)
  --work-dir <dir>     Directory to extract the runner (default: temp dir)
  --labels <labels>    Comma-separated labels (default: self-hosted,<os>,<arch>)
  --pid-file <file>    Write the runner process PID to this file
  --persistent         Keep runner online for multiple jobs
  --ephemeral          Remove runner after one job (default)
  --detach             Register, start the runner, and exit (runner keeps running)
`);
  process.exit(0);
}

const owner = args.owner || process.env.OWNER;
const repo = args.repo || process.env.REPO;
const token = args.token || process.env.RUNNER_TOKEN;
const persistent = args.persistent;
const detach = args.detach;
const ghBinary = process.env.GH_BINARY || 'gh';

if (!owner || !repo || !token) {
  console.error('Set --owner, --repo and --token (or OWNER/REPO/RUNNER_TOKEN env vars).');
  process.exit(1);
}

function archSuffix() {
  if (process.arch === 'arm64') return 'arm64';
  if (process.arch === 'x64') return 'x64';
  if (process.arch === 'arm') return 'arm';
  throw new Error(`Unsupported architecture: ${process.arch}`);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const workDir = args.workDir
  ? path.resolve(args.workDir)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'gh-runner-'));
if (args.workDir && !fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}

const pidFile = args.pidFile ? path.resolve(args.pidFile) : undefined;
if (pidFile) {
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
}

console.log('Using gh binary:', ghBinary);
console.log('Runner directory:', workDir);

const release = JSON.parse(execFileSync(ghBinary, ['api', 'repos/actions/runner/releases/latest', '--jq', '{tag:.tag_name,body:.body}'], { encoding: 'utf8' }));
const tag = release.tag;
const body = release.body;
const version = tag.replace(/^v/, '');

const arch = archSuffix();
const platform = os.platform();
const shaPlatform = { linux: 'linux', darwin: 'osx', win32: 'win' }[platform];
const runnerPlatform = { linux: 'linux', darwin: 'macos', win32: 'windows' }[platform];

if (!shaPlatform || !runnerPlatform) {
  throw new Error(`Unsupported platform: ${platform}`);
}

let asset, configCmd, runCmd, shell;
if (platform === 'linux') {
  asset = `actions-runner-linux-${arch}-${version}.tar.gz`;
  configCmd = './config.sh';
  runCmd = './run.sh';
} else if (platform === 'darwin') {
  asset = `actions-runner-osx-${arch}-${version}.tar.gz`;
  configCmd = './config.sh';
  runCmd = './run.sh';
} else if (platform === 'win32') {
  asset = `actions-runner-win-${arch}-${version}.zip`;
  configCmd = 'config.cmd';
  runCmd = 'run.cmd';
  shell = true;
} else {
  throw new Error(`Unsupported platform: ${platform}`);
}

const archive = path.join(workDir, asset);

function run(name, argv, options = {}) {
  const result = spawnSync(name, argv, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command "${name}" exited with status ${result.status}`);
  return result;
}

execFileSync(ghBinary, ['release', 'download', '-R', 'actions/runner', tag, '-D', workDir, '-p', asset], { stdio: 'inherit' });

const shaKey = `${shaPlatform}-${arch}`;
const checksumRe = new RegExp(`<!-- BEGIN SHA ${shaKey} -->([a-f0-9]{64})<!-- END SHA ${shaKey} -->`, 'i');
const match = body ? body.match(checksumRe) : null;
if (match) {
  const expectedChecksum = match[1].toLowerCase();
  const actualChecksum = sha256(archive).toLowerCase();
  if (expectedChecksum !== actualChecksum) {
    throw new Error(`SHA-256 mismatch for ${asset}: expected ${expectedChecksum}, got ${actualChecksum}`);
  }
  console.log('SHA-256 checksum verified for', asset);
} else {
  console.warn('No SHA-256 checksum marker found for', shaKey, 'in release notes; skipping verification.');
}

process.chdir(workDir);
if (platform === 'win32') {
  function psLiteral(s) { return s.replace(/'/g, "''"); }
  run('powershell', ['-Command', `Expand-Archive -LiteralPath '${psLiteral(archive)}' -DestinationPath '${psLiteral(workDir)}'`]);
} else {
  run('tar', ['xzf', archive]);
}

const runnerName = `act-runner-${Date.now()}`;
fs.writeFileSync(path.join(workDir, 'runner-name.txt'), runnerName);
console.log('Runner name:', runnerName);

const labels = args.labels || `self-hosted,${runnerPlatform},${arch}`;
const configArgs = [
  '--url', `https://github.com/${owner}/${repo}`,
  '--token', token,
  '--name', runnerName,
  '--labels', labels,
  '--unattended',
];
if (!persistent) configArgs.push('--ephemeral');

if (shell) {
  run('cmd.exe', ['/d', '/s', '/c', configCmd, ...configArgs], { shell: false });
} else {
  run(configCmd, configArgs);
}

function getRunnerId() {
  try {
    const runnerFile = path.join(workDir, '.runner');
    if (fs.existsSync(runnerFile)) {
      const raw = fs.readFileSync(runnerFile, 'utf8');
      const runner = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (runner.agentId) return runner.agentId;
    }
  } catch (e) {
    console.warn('Could not read .runner file:', e.message);
  }
  return null;
}

function removeRunner() {
  const runnerId = getRunnerId();
  if (runnerId) {
    try {
      execFileSync(ghBinary, ['api', '--method', 'DELETE', `repos/${owner}/${repo}/actions/runners/${runnerId}`], { stdio: 'pipe' });
      console.log(`Removed runner registration ${runnerId}`);
      return;
    } catch (e) {
      console.error('Could not remove runner by .runner id:', e.message);
    }
  }

  try {
    const output = execFileSync(ghBinary, [
      'api', '--paginate', `repos/${owner}/${repo}/actions/runners`,
      '--jq', '.runners[] | {id: .id, name: .name}',
    ], { encoding: 'utf8', stdio: 'pipe' }).trim();
    if (!output) return;
    const runners = output.split('\n').filter(Boolean).map(JSON.parse);
    const r = runners.find(x => x.name === runnerName);
    if (r) {
      execFileSync(ghBinary, ['api', '--method', 'DELETE', `repos/${owner}/${repo}/actions/runners/${r.id}`], { stdio: 'pipe' });
      console.log(`Removed runner registration ${runnerName}`);
    }
  } catch (e) {
    console.error('Could not remove runner registration:', e.message);
  }
}

function cleanup() {
  if (detach) return;
  removeRunner();
  if (persistent) return;
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch (e) {
    console.error('Cleanup failed:', e.message);
    process.exitCode = 1;
  }
}

function startRunner() {
  const stdio = detach ? 'ignore' : 'inherit';
  if (shell) {
    return spawn('cmd.exe', ['/d', '/s', '/c', runCmd], { stdio, shell: false, detached: detach });
  }
  return spawn(runCmd, [], { stdio, detached: detach });
}

const child = startRunner();

if (pidFile) {
  fs.writeFileSync(pidFile, String(child.pid));
}

if (detach) {
  child.unref();
  console.log('Detached runner process:', child.pid);
  console.log('Stop it later with `node scripts/cleanup-runner.cjs` (and pass --pid-file if used).');
  process.exit(0);
}

process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

child.on('exit', (code) => {
  cleanup();
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Runner process error:', err);
  cleanup();
  process.exit(1);
});
