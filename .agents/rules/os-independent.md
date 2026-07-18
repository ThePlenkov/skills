# OS-Independent Skills and Commands

These skills are consumed on Linux, macOS, and Windows. All commands, scripts, and paths referenced in skills must work across those platforms, or the skill must provide an explicit Windows alternative.

## For skill authors

- Prefer commands that are available on all platforms: `git`, `npm`, `npx`, `node`, `tsx`, `python`.
- Avoid POSIX-only shell syntax in examples: `&&`, `||`, `;`, `2>&1`, `| tail`, `$(...)`, backticks, `mkdir -p`, `cat <<EOF`, `chmod`, `source`, `test -e`.
- Do not use Unix-only paths: `/tmp`, `/dev/null`, `/usr/bin`, `~/.local/bin` without a Windows note.
- For file or directory creation, instruct the agent to use its file tools or a cross-platform runner instead of `cat`/`mkdir` here-document snippets.
- When a skill ships helper scripts, invoke them through the cross-platform runner:

  ```bash
  npx tsx scripts/run.ts <path-to-script> [args...]
  ```

- If a command is unavoidably POSIX-only, provide the equivalent PowerShell/Git Bash/WSL command or a note that Windows users should run it in Git Bash/WSL.

## For agents running these skills

- On POSIX, run shell commands in `bash`/`sh` as usual.
- On Windows, prefer `cmd`/`PowerShell` equivalents or run POSIX commands through Git Bash/WSL.
- Use the repo's `scripts/run.ts` wrapper to execute any `.sh` or extensionless shell script cross-platform.
- When a skill says `bash scripts/<name>.sh`, translate it to `npx tsx scripts/run.ts scripts/<name>.sh` on Windows.
