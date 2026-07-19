import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTrustedBash } from "./lib/find-bash.ts";
import { toPosixPath } from "./lib/posix-path.ts";

const USAGE = "Usage: npx tsx scripts/run.ts <repo-root-relative-script> [args...]";

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(USAGE);
    process.exit(1);
  }

  // The runner lives at <repo-root>/scripts/run.ts, so its parent is the repo root.
  const repoRoot = resolve(fileURLToPath(import.meta.url), "..", "..");
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

  if (ext === ".ts" || ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    command = "node";
    commandArgs = ["--import", "tsx", scriptPath, ...rest];
  } else if (ext === ".py") {
    command = process.platform === "win32" ? "python" : "python3";
    commandArgs = [scriptPath, ...rest];
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
    commandArgs = [toPosixPath(scriptPath), ...rest];
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
