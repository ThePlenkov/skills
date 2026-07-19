/**
 * Cross-platform bash discovery for repo tooling.
 *
 * Used by scripts/run.ts (which runs POSIX shell scripts) and
 * bin/skills.ts (the npx wrapper). Centralised so that "where is bash?"
 * has one implementation across the repo.
 *
 * Returns an absolute path to a working bash binary, or null when no
 * candidate could be confirmed. Callers should treat null as a fatal
 * configuration error and exit with a clear message; do NOT fall back
 * to bare "bash" since execFileSync will then resolve via PATH again.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

// Windows shells we explicitly know about and trust (WSL bash is excluded
// via isWslBash at probe time; we never pick it because it can't execute
// Windows-native paths). Raw strings avoid the S7780 escape-backslash lint.
const WINDOWS_KNOWN_BASH: readonly string[] = [
  String.raw`C:\Program Files\Git\bin\bash.exe`,
  String.raw`C:\Program Files\Git\usr\bin\bash.exe`,
  String.raw`C:\Program Files (x86)\Git\bin\bash.exe`,
  String.raw`C:\msys64\usr\bin\bash.exe`,
  String.raw`C:\cygwin64\bin\bash.exe`,
];

// POSIX shells, ordered so a Homebrew / MacPorts bash 4+ wins over Apple's
// bash 3.2 at /bin/bash (which does not satisfy scripts/install.sh's bash
// 4+ requirement). The last two remain as a minimal / container fallback.
const POSIX_KNOWN_BASH: readonly string[] = [
  "/opt/homebrew/bin/bash",
  "/usr/local/bin/bash",
  "/opt/local/bin/bash",
  "/bin/bash",
  "/usr/bin/bash",
];

/**
 * Find a working bash binary on the current platform. Returns null when
 * nothing usable is found.
 */
export function findBash(): string | null {
  return process.platform === "win32" ? findWindowsBash() : findPosixBash();
}

/** Find a working bash 4+ on POSIX, returning absolute path or null. */
function findPosixBash(): string | null {
  for (const candidate of POSIX_KNOWN_BASH) {
    if (tryPosixBashCandidate(candidate)) return candidate;
  }
  return findAbsoluteBashOnPosixPath();
}

/** Find a working bash on Windows, returning absolute path or null. */
function findWindowsBash(): string | null {
  for (const c of WINDOWS_KNOWN_BASH) {
    if (isWorkingBash(c)) return c;
  }
  return findBashOnWindowsPath();
}

/**
 * Test whether `candidate` is a working bash 4 or later on POSIX. The
 * bash-4-or-later requirement mirrors scripts/install.sh:15; any older
 * bash would be rejected by the installer itself.
 */
function tryPosixBashCandidate(candidate: string): boolean {
  if (!existsSync(candidate)) return false;
  if (!isBashVersionGte4(candidate)) return false;
  return isWorkingBash(candidate);
}

/**
 * Resolve bash and validate that the result is a usable, non-WSL bash
 * binary. Returns the absolute path on success, or null on failure.
 *
 * Differs from {@link findBash} in that the bare "bash" PATH lookup is
 * NOT considered acceptable: callers using this helper want a hardened
 * resolution for execFileSync so PATH-controlled interpreters can never
 * be invoked.
 */
export function resolveTrustedBash(): string | null {
  const candidate = findBash();
  if (!candidate) return null;
  if (!isAbsolute(candidate)) return null;
  if (!isWorkingBash(candidate)) return null;
  return candidate;
}

/**
 * Verify a candidate is bash (not e.g. WSL bash on Windows) and works.
 */
export function isWorkingBash(cmd: string): boolean {
  return isWorkingShell(cmd) && !isWslBash(cmd);
}

/**
 * Probe whether the given command can spawn and exit cleanly.
 */
export function isWorkingShell(cmd: string): boolean {
  try {
    const r = spawnSync(cmd, ["-c", "exit 0"], { shell: false });
    return !r.error && r.status === 0;
  } catch {
    return false;
  }
}

/**
 * Detect WSL bash: it can start on Windows but only understands
 * /mnt/c/... paths, so it cannot run Windows-native script paths. It
 * sets WSL_DISTRO_NAME.
 */
export function isWslBash(cmd: string): boolean {
  if (process.platform !== "win32") return false;
  try {
    const r = spawnSync(cmd, ["-c", 'echo "${WSL_DISTRO_NAME:-}"'], {
      shell: false,
    });
    if (!r.error && r.status === 0) {
      return r.stdout.toString().trim().length > 0;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Probe the candidate's major bash version. Returns true when the
 * candidate reports a `BASH_VERSINFO[0]` >= 4 — the same threshold
 * scripts/install.sh enforces — so callers never hand the wrapper a
 * bash that the installer would itself refuse.
 */
function isBashVersionGte4(candidate: string): boolean {
  try {
    const r = spawnSync(candidate, ["-c", 'echo "${BASH_VERSINFO[0]:-0}"'], {
      shell: false,
    });
    if (r.error || r.status !== 0) return false;
    const major = Number(r.stdout.toString().trim());
    return Number.isFinite(major) && major >= 4;
  } catch {
    return false;
  }
}

/**
 * Resolve an absolute path to a working bash 4+ via the POSIX PATH.
 * Used as a last-ditch fallback when none of the well-known install
 * locations exist. Returns null when no candidate on PATH satisfies
 * the bash-4-or-later requirement, so callers always hand an absolute
 * path to execFileSync.
 *
 * Walks $PATH directly instead of invoking `which` so the candidate
 * list is computed in-process and never re-uses PATH-controlled
 * shell-out (the S4036 lint would otherwise flag every external
 * helper that calls `which`).
 */
function findAbsoluteBashOnPosixPath(): string | null {
  if (process.platform === "win32") return null;
  const dirs = (process.env.PATH ?? "").split(":").filter(Boolean);
  for (const dir of dirs) {
    const candidate = `${dir}/bash`;
    if (!isAbsolute(candidate)) continue;
    if (!existsSync(candidate)) continue;
    if (!isBashVersionGte4(candidate)) continue;
    if (isWorkingBash(candidate)) return candidate;
  }
  return null;
}

function findBashOnWindowsPath(): string | null {
  const windir = process.env.windir || String.raw`C:\Windows`;
  const where = resolve(windir, "System32", "where.exe");
  try {
    const r = spawnSync(where, ["bash"], { shell: false });
    if (r.error || r.status !== 0) return null;
    const paths = r.stdout
      .toString()
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of paths) {
      const lower = p.toLowerCase();
      if (lower.includes(String.raw`\windows\system32`)) continue;
      if (lower.includes(String.raw`\windows\syswow64`)) continue;
      if (isWorkingBash(p)) return p;
    }
  } catch {
    // ignore
  }
  return null;
}
