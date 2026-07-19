import { spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTrustedBash } from "./lib/find-bash.ts";
import { toPosixPath } from "./lib/posix-path.ts";

const USAGE =
  "Usage: npx tsx scripts/run.ts <repo-relative-or-absolute-script-path> [args...]\n" +
  "       (absolute paths must still resolve to a regular file inside the repo)";

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  // The runner lives at <repo-root>/scripts/run.ts, so its parent is the repo root.
  // We realpath it so the containment check below compares against the same form
  // the OS uses to look up script paths — otherwise a symlinked repo root could
  // produce a false `..`-prefixed relative path and reject every legitimate script.
  const repoRoot = realpathSync(resolve(fileURLToPath(import.meta.url), "..", ".."));
  const scriptArg = args[0];
  const scriptPath = isAbsolute(scriptArg) ? resolve(scriptArg) : resolve(repoRoot, scriptArg);

  // Path containment + type guard: the script must resolve to a regular file
  // inside the repo. Lexical containment alone (relative + '..') is bypassable
  // by an in-repo symlink that points outside the repo, so we dereference via
  // realpath and re-check the containment boundary against the realpath.
  //
  // Also rejects directories and missing paths before they reach spawnSync,
  // where they would otherwise fall through to the POSIX-shell branch.
  //
  // Trust boundary: the "Verify .agents/skills symlinks" CI guard and the
  // Wrong-vs-right row in skills/code-review/act/SKILL.md define which
  // symlinks this runner trusts.
  let realScriptPath: string;
  try {
    const stat = statSync(scriptPath);
    if (!stat.isFile()) {
      console.error(`Script must be a regular file: ${scriptPath}`);
      process.exit(1);
    }
    realScriptPath = realpathSync(scriptPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error(`Script not found: ${scriptPath}`);
    } else if (code === "EACCES" || code === "EPERM") {
      console.error(`Script not accessible (${code}): ${scriptPath}`);
    } else {
      console.error(`Cannot resolve script (${code ?? "unknown"}): ${scriptPath}`);
    }
    process.exit(1);
  }

  const rel = relative(repoRoot, realScriptPath);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    console.error(`Script must resolve to a file inside the repo (${repoRoot}): ${realScriptPath}`);
    process.exit(1);
  }

  const ext = extname(realScriptPath).toLowerCase();
  const rest = args.slice(1);
  let command: string;
  let commandArgs: string[];

  if (ext === ".ts" || ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    command = "node";
    commandArgs = ["--import", "tsx", realScriptPath, ...rest];
  } else if (ext === ".py") {
    command = process.platform === "win32" ? "python" : "python3";
    commandArgs = [realScriptPath, ...rest];
  } else {
    const bash = resolveTrustedBash();
    if (!bash) {
      console.error(
        "A POSIX shell (bash 4+) is required to run this script. Install bash 4 or later (on macOS: `brew install bash`) or, on Windows, install Git for Windows and ensure bash is on PATH.",
      );
      process.exit(1);
    }
    command = bash;
    // Git Bash/MSYS needs forward-slash paths; Node gives Windows paths with backslashes.
    commandArgs = [toPosixPath(realScriptPath), ...rest];
  }

  const result = spawnSync(command, commandArgs, { stdio: "inherit", shell: false });
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

main();
