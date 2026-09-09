#!/usr/bin/env node
// Remove a runner registered by runner.cjs from the repo, then delete its local directory.

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { help: false };
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === '--owner') { args.owner = next; i++; }
    else if (key === '--repo') { args.repo = next; i++; }
    else if (key === '--work-dir') { args.workDir = next; i++; }
    else if (key === '--pid-file') { args.pidFile = next; i++; }
    else if (key === '--help' || key === '-h') { args.help = true; }
    else { throw new Error(`Unknown argument: ${key}`); }
  }
  return args;
}

const args = parseArgs(process.argv);

if (args.help) {
  console.log(`Usage: node cleanup-runner.cjs --owner <owner> --repo <repo> --work-dir <dir> [--pid-file <file>]

Removes the runner configured in <work-dir> from the repo,
deletes <work-dir>, and optionally kills the runner process tree identified
by --pid-file.
`);
  process.exit(0);
}

const owner = args.owner || process.env.OWNER;
const repo = args.repo || process.env.REPO;
const workDir = args.workDir ? path.resolve(args.workDir) : process.env.WORK_DIR;

if (!owner || !repo || !workDir) {
  console.error('Set --owner, --repo and --work-dir (or OWNER/REPO/WORK_DIR env vars).');
  process.exit(1);
}

const ghBinary = process.env.GH_BINARY || 'gh';

if (args.pidFile && fs.existsSync(args.pidFile)) {
  const pid = Number(fs.readFileSync(args.pidFile, 'utf8').trim());
  if (pid) {
    console.log(`Stopping runner process ${pid}...`);
    const platform = process.platform;
    try {
      if (platform === 'win32') {
        spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore' });
      } else {
        // Kill the process group so child Runner.Listener processes stop too.
        try { process.kill(-pid, 'SIGTERM'); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.error('Warning: could not stop runner process:', e.message);
    }
  }
  try { fs.unlinkSync(args.pidFile); } catch (e) { /* ignore */ }
}

const runnerFile = path.join(workDir, '.runner');
const runnerNameFile = path.join(workDir, 'runner-name.txt');

function getRunnerId() {
  if (fs.existsSync(runnerFile)) {
    try {
      const raw = fs.readFileSync(runnerFile, 'utf8');
      const runner = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (runner.agentId) {
        console.log('Removing runner from .runner:', runner.agentId, runner.agentName);
        return runner.agentId;
      }
    } catch (e) {
      console.warn('Could not parse .runner file:', e.message);
    }
  }
  if (fs.existsSync(runnerNameFile)) {
    // Fallback: find by name. This requires a token with runner list permission.
    const runnerName = fs.readFileSync(runnerNameFile, 'utf8').trim();
    try {
      const runnersOutput = execFileSync(ghBinary, [
        'api', '--paginate', `repos/${owner}/${repo}/actions/runners`,
        '--jq', '.runners[] | {id: .id, name: .name}',
      ], { encoding: 'utf8' }).trim();

      if (runnersOutput) {
        const runners = runnersOutput.split('\n').filter(Boolean).map(JSON.parse);
        const r = runners.find(x => x.name === runnerName);
        if (r) {
          console.log('Removing runner by name lookup:', r.name);
          return r.id;
        }
      }
    } catch (e) {
      console.warn('Could not list runners by name:', e.message);
    }
  }
  return null;
}

const runnerId = getRunnerId();
if (!runnerId) {
  throw new Error(`No .runner or runner-name.txt found in ${workDir}; cannot identify runner`);
}

try {
  execFileSync(ghBinary, ['api', '--method', 'DELETE', `repos/${owner}/${repo}/actions/runners/${runnerId}`]);
  console.log(`Removed runner ${runnerId}`);
} catch (e) {
  console.error(`Could not remove runner ${runnerId}:`, e.message);
}

fs.rmSync(workDir, { recursive: true, force: true });
console.log('Removed runner directory');
