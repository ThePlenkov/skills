/**
 * Wrapper around `scripts/install.sh` that lets `npx github:theplenkov/skills`
 * install skills directly from GitHub.
 *
 * The package's `bin` entry points at `bin/skills.js`, which is a 2-line shim
 * that imports this file via `import("./skills.ts")`. Node ≥22.6 is required
 * so `--experimental-strip-types` parses the TS source.
 *
 * Flag summary (further constrained in --help and in the validation below):
 *   --home / --project / --target=DIR   mutually exclusive destination
 *   --copy / --no-copy                  copy mode toggle; --copy is the default
 *   --dry-run / --check / --force / --help
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTrustedBash } from "../scripts/lib/find-bash.ts";
import { toPosixPath } from "../scripts/lib/posix-path.ts";

const __dirname: string = dirname(fileURLToPath(import.meta.url));
const repoRoot: string = join(__dirname, "..");
const installScript: string = join(repoRoot, "scripts", "install.sh");

/** Shape that a Node child-process error exposes when spawn fails. */
interface ExecError extends Error {
  status?: number | string;
}

const args: string[] = process.argv.slice(2);

function printHelp(): never {
  console.log(`
Usage: npx github:theplenkov/skills [options]

Requires Node.js >=22.6 (uses --experimental-strip-types to run this TS file).

Destination (mutually exclusive):
  --home            Install skills to ~/.agents/skills/ (default)
  --project         Install skills to ./.agents/skills/ in the caller's current directory
  --target=DIR      Install skills into an explicit directory (advanced; mainly
                    used internally by --project and direct local installs)

Install mode:
  --copy            Copy skill files into the target instead of creating
                    symlinks. Default for the wrapper because npx/bunx/pnpm dlx
                    extract the repo into a transient cache; symlinks would
                    dangle when the cache is pruned.
  --no-copy         Use symlinks instead (recommended for stable local clones,
                    paired with --target=DIR or the repo-local fallback).

Other options:
  --dry-run         Print what would be done without changing anything
  --check           Verify the target directory is in sync
  --force           Permit install.sh to clobber foreign entries in the target
                    that don't already match a current skill (e.g. files the
                    user dropped into ~/.agents/skills). Without --force,
                    install.sh refuses to delete such content.

  --help            Show this help message

Examples:
  npx github:theplenkov/skills
  npx github:theplenkov/skills --project
  npx github:theplenkov/skills --dry-run
  # Stable local checkout (symlinks into the repo):
  npx github:theplenkov/skills --no-copy --target=$PWD/.agents/skills
`);
  process.exit(0);
}

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
}

// --- Flag validation -------------------------------------------------------
// Destination: --home/--project/--target=DIR are mutually exclusive; duplicates are rejected.
const homeCount: number = args.filter((a) => a === "--home").length;
const projectCount: number = args.filter((a) => a === "--project").length;
const targetCount: number = args.filter((a) => a.startsWith("--target")).length;
if (homeCount > 1) {
  console.error("Error: --home may only be specified once.");
  process.exit(2);
}
if (projectCount > 1) {
  console.error("Error: --project may only be specified once.");
  process.exit(2);
}
if (targetCount > 1) {
  console.error("Error: --target may only be specified once.");
  process.exit(2);
}
const destinationCount: number = homeCount + projectCount + targetCount;
if (destinationCount > 1) {
  console.error(
    "Error: --home, --project, and --target=DIR are mutually exclusive.",
  );
  process.exit(2);
}

const wantsHome: boolean = homeCount === 1;
const wantsProject: boolean = projectCount === 1;
const hasTarget: boolean = targetCount === 1;

// Mode toggle: --copy and --no-copy are mutually exclusive.
const copyFlagCount: number = args.filter(
  (a) => a === "--copy" || a === "--no-copy",
).length;
if (copyFlagCount > 1) {
  console.error("Error: --copy and --no-copy are mutually exclusive.");
  process.exit(2);
}
// --copy is the unconditional default. Pass --no-copy to opt out (e.g. when
// running from a stable local clone where symlinks into the repo make sense).
if (args.includes("--no-copy")) {
  args.splice(args.indexOf("--no-copy"), 1);
} else if (!args.includes("--copy")) {
  args.push("--copy");
}

if (wantsProject) {
  args.splice(args.indexOf("--project"), 1);
  // Pass the caller's working directory explicitly to install.sh so the
  // installed trees land under ./.agents/skills/ relative to the caller.
  args.push(`--target=${toPosixPath(join(process.cwd(), ".agents", "skills"))}`);
} else if (!wantsHome && !hasTarget) {
  args.unshift("--home");
}

// --- Resolve bash to an absolute path --------------------------------------
// execFileSync("bash", ...) consults PATH for the binary, which SonarCloud
// flags as a security risk (an attacker who controls PATH could swap bash).
// resolveTrustedBash() (shared with scripts/run.ts) returns an absolute
// path to a working bash, probing Git Bash / MSYS2 / Cygwin on Windows and
// /bin/bash / /usr/bin/bash on POSIX. It rejects bare "bash" or any non-
// absolute result so we never re-introduce the PATH lookup execFileSync
// would otherwise perform.
const bashPath = resolveTrustedBash();
if (!bashPath) {
  console.error(
    "Error: could not resolve bash to a trusted absolute path. Tried Git Bash / MSYS2 / Cygwin on Windows, /bin/bash and /usr/bin/bash on POSIX, and a working-shell fallback.",
  );
  console.error("Refusing to invoke a PATH-resolved interpreter.");
  process.exit(127);
}

try {
  // MSYS/Git Bash needs POSIX-form script paths (e.g. /c/Users/...) or
  // backslashes are interpreted as escape characters. The same helper is
  // used in scripts/run.ts so both spawn paths agree on Windows.
  execFileSync(bashPath, [toPosixPath(installScript), ...args], {
    stdio: "inherit",
    cwd: repoRoot,
  });
} catch (err) {
  const e = err as ExecError;
  if (typeof e.status !== "number") {
    console.error(
      `Error: failed to execute install script at ${bashPath}: ${e?.message ?? e}`,
    );
    console.error(
      "Make sure bash is installed and reachable (looked for /bin/bash, /usr/bin/bash, common Homebrew/MacPorts locations on POSIX, and Git Bash / MSYS2 / Cygwin on Windows).",
    );
  }
  process.exit(typeof e.status === "number" ? e.status : 1);
}
