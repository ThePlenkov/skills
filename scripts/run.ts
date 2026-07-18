import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: npx tsx scripts/run.ts <repo-root-relative-script> [args...]';

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  // The runner lives at <repo-root>/scripts/run.ts, so its parent is the repo root.
  const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  const scriptArg = args[0];
  const scriptPath = isAbsolute(scriptArg) ? resolve(scriptArg) : resolve(repoRoot, scriptArg);

  if (!existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`);
    process.exit(1);
  }

  const ext = extname(scriptPath).toLowerCase();
  const rest = args.slice(1);
  let command: string;
  let commandArgs: string[];

  if (ext === '.ts' || ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    command = 'node';
    commandArgs = ['--import', 'tsx', scriptPath, ...rest];
  } else if (ext === '.py') {
    command = process.platform === 'win32' ? 'python' : 'python3';
    commandArgs = [scriptPath, ...rest];
  } else {
    const bash = findBash();
    if (!bash) {
      console.error(
        'A POSIX shell is required to run this script. On Windows, install Git for Windows and ensure bash is on PATH.'
      );
      process.exit(1);
    }
    command = bash;
    // Git Bash/MSYS needs forward-slash paths; Node gives Windows paths with backslashes.
    commandArgs = [toPosixPath(scriptPath), ...rest];
  }

  const result = spawnSync(command, commandArgs, { stdio: 'inherit', shell: false });
  if (result.error) {
    console.error(`Failed to spawn ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.signal) {
    console.error(`Process killed by signal: ${result.signal}`);
    process.exit(1);
  }
  process.exit(result.status ?? 0);
}

function findBash(): string | null {
  if (process.platform === 'win32') {
    // Prefer known Git Bash / MSYS2 / Cygwin locations to avoid accidentally
    // picking up WSL's bash (C:\Windows\System32\bash.exe), which uses a
    // different filesystem namespace and cannot execute Windows-native paths.
    const candidates = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      'C:\\msys64\\usr\\bin\\bash.exe',
      'C:\\cygwin64\\bin\\bash.exe',
    ];
    for (const c of candidates) {
      if (isWorkingBash(c)) return c;
    }

    const fromPath = findBashOnWindowsPath();
    if (fromPath) return fromPath;
  } else {
    if (isWorkingBash('bash')) return 'bash';
  }

  if (isWorkingShell('sh')) return 'sh';

  return null;
}

function isWorkingBash(cmd: string): boolean {
  return isWorkingShell(cmd) && !isWslBash(cmd);
}

function isWorkingShell(cmd: string): boolean {
  try {
    const r = spawnSync(cmd, ['-c', 'exit 0'], { shell: false });
    return !r.error && r.status === 0;
  } catch {
    return false;
  }
}

function isWslBash(cmd: string): boolean {
  // WSL bash can start on Windows but only understands /mnt/c/... paths, so it
  // cannot run Windows-native script paths. It sets WSL_DISTRO_NAME.
  if (process.platform !== 'win32') return false;
  try {
    const r = spawnSync(cmd, ['-c', 'echo "${WSL_DISTRO_NAME:-}"'], { shell: false });
    if (!r.error && r.status === 0) {
      return r.stdout.toString().trim().length > 0;
    }
  } catch {
    // ignore
  }
  return false;
}

function findBashOnWindowsPath(): string | null {
  const windir = process.env.windir || 'C:\\Windows';
  const where = resolve(windir, 'System32', 'where.exe');
  try {
    const r = spawnSync(where, ['bash'], { shell: false });
    if (r.error || r.status !== 0) return null;
    const paths = r.stdout
      .toString()
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of paths) {
      const lower = p.toLowerCase();
      if (lower.includes('\\windows\\system32')) continue;
      if (lower.includes('\\windows\\syswow64')) continue;
      if (isWorkingBash(p)) return p;
    }
  } catch {
    // ignore
  }
  return null;
}

function toPosixPath(p: string): string {
  // Convert Windows drive letter (C:\ or C:/) to MSYS-style /c/.
  const withDrive = p.replace(/^[A-Za-z]:[\\/]/, (m) => `/${m[0].toLowerCase()}/`);
  return withDrive.replace(/\\/g, '/');
}

main();
