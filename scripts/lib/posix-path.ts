/**
 * Normalize a possibly-Windows path to the MSYS/Git-Bash POSIX form so it
 * can be passed to bash on Windows. Native paths (C:\...) break MSYS bash
 * because it sees the backslashes as escape characters; the documented fix
 * is to rewrite C:\foo to /c/foo before spawning bash.
 *
 * On POSIX this is a no-op; only drive-letter and backslash normalization
 * is applied so callers can hand the same input to spawn across platforms.
 */
export function toPosixPath(p: string): string {
  const withDrive = p.replace(/^[A-Za-z]:[\\/]/, (m) => `/${m[0].toLowerCase()}/`);
  return withDrive.replaceAll("\\", "/");
}
