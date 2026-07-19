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
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, dirname, isAbsolute, join, resolve } from "node:path";
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

// Effective destination, computed AFTER the args mutation above so the
// implicit --home default is honoured by the materialise block below as
// well as by install.sh.
const effectiveProject: boolean = wantsProject;
const effectiveHome: boolean = wantsHome || args.includes("--home");
const effectiveTarget: boolean = hasTarget;

// True when `targetDir` ends in `…/.agents/skills` — the only layout
// `npx skills add` knows how to materialise from a single cwd. Off-layout
// `--target=DIR` values are handled by the install.sh-side copy alone
// (the user can re-run `npx skills add` themselves if they want externals
// under an arbitrary directory).
function isStandardSkillsLayout(targetDir: string): boolean {
  const parent = dirname(targetDir);
  return basename(parent) === ".agents" && basename(targetDir) === "skills";
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
    "Error: could not resolve bash to a trusted absolute path. Tried Git Bash / MSYS2 / Cygwin on Windows, and /bin/bash and /usr/bin/bash on POSIX, and a working-shell fallback.",
  );
  console.error("Refusing to invoke a PATH-resolved interpreter.");
  process.exit(127);
}

// Resolve `npx` to an absolute path so we never re-introduce the
// `execFileSync("npx", ...)` pattern that SonarCloud flags as a security
// risk — an attacker who controls PATH could otherwise swap the binary.
// Mirrors `resolveTrustedBash()` (above) for bash: we accept only an
// absolute path (a relative entry in PATH is rejected as untrusted) and
// probe every candidate filename (`npx`, `npx.cmd`, `npx.exe`, `npx.bat`)
// per PATH entry so Windows installations are handled the same way.
const NPX_CANDIDATES: readonly string[] = ["npx", "npx.cmd", "npx.exe", "npx.bat"];
function resolveTrustedNpx(): string | null {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const name of NPX_CANDIDATES) {
      const candidate = join(dir, name);
      if (!isAbsolute(candidate)) continue;
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const npxPath = resolveTrustedNpx();
// (No eager npx-missing check: `npx` is only required inside the
// materialise loop, and only when the lockfile actually has external
// entries. Validating up-front would break --check / --dry-run / lockfile
// absent / bunx-or-pnpm-dlx runtimes that don't need npx at all.)

// --- Materialise external skills before install.sh --------------------------
// install.sh tracks externals via `skills-lock.json` (see its positive-presence
// check) but it does not know the external source URLs. To keep `npx
// github:theplenkov/skills` as a single command for "install everything in
// this repo", the wrapper delegates external installation to `npx skills
// add`. We iterate the lockfile, skip `sourceType: "local"` (those still
// come from `skills/`), and skip entries already present so re-runs stay
// idempotent. Non-installation modes (--check, --dry-run) skip this step.
const wantsMaterialise: boolean =
  !args.includes("--check") && !args.includes("--dry-run");

if (wantsMaterialise) {
  const lockfilePath: string = join(repoRoot, "skills-lock.json");
  if (existsSync(lockfilePath)) {
    let lockfileJson: unknown;
    try {
      lockfileJson = JSON.parse(readFileSync(lockfilePath, "utf8"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `Error: failed to parse ${lockfilePath}: ${msg}. Run \`npx skills update\` to regenerate, or remove the lockfile.`,
      );
      process.exit(1);
    }
    // `lockfileJson.skills` must be a plain object record — guards against
    // a malformed lockfile with `.skills: []`, which would otherwise be
    // iterated by `Object.entries` and treated as integer-keyed entries.
    const rawSkills =
      lockfileJson !== null &&
      typeof lockfileJson === "object" &&
      "skills" in lockfileJson
        ? (lockfileJson as { skills: unknown }).skills
        : null;
    if (rawSkills !== null && rawSkills !== undefined && !Array.isArray(rawSkills) && typeof rawSkills !== "object") {
      console.error(
        "Error: skills-lock.json 'skills' field is not a JSON object. Run \`npx skills update\` to regenerate.",
      );
      process.exit(1);
    }
    if (Array.isArray(rawSkills)) {
      console.error(
        "Error: skills-lock.json 'skills' must be an object, not an array. Run \`npx skills update\` to regenerate.",
      );
      process.exit(1);
    }
    const lockfileSkills =
      rawSkills !== null && rawSkills !== undefined && typeof rawSkills === "object"
        ? (rawSkills as Record<string, unknown>)
        : null;

    if (lockfileSkills) {
      // Resolve the target directory as the OS-native path (no MSYS-style
      // POSIX conversion) — `existsSync` and `execFileSync cwd` need the
      // form the OS understands. install.sh gets a converted form via the
      // `args.push` above for `--project`, and computes its own MSYS path
      // for `--home` (it already calls `homedir()` under bash).
      let targetDir: string | null = null;
      if (effectiveProject) {
        targetDir = join(process.cwd(), ".agents", "skills");
      } else if (effectiveTarget) {
        const targetArg = args.find((a) => a.startsWith("--target="));
        if (targetArg !== undefined) {
          // Resolve relative --target paths against the caller's CWD (not
          // the repo root) so the wrapper's destination matches what the
          // user typed at the shell.
          const raw = targetArg.slice("--target=".length);
          targetDir = isAbsolute(raw) ? raw : resolve(raw);
        }
      } else if (effectiveHome) {
        targetDir = join(homedir(), ".agents", "skills");
      }

      if (targetDir !== null) {
        if (!isStandardSkillsLayout(targetDir)) {
          console.error(
            `Note: target '${targetDir}' is not a standard '…/.agents/skills' layout; external skills must be materialised manually via \`npx skills add\`.`,
          );
        }
        for (const [name, rawEntry] of Object.entries(lockfileSkills)) {
          if (
            rawEntry === null ||
            typeof rawEntry !== "object" ||
            Array.isArray(rawEntry)
          ) {
            continue;
          }
          // Apply the same allowlist `scripts/install.sh` enforces
          // (see `KNOWN_SOURCE_TYPES` in install.sh) so the wrapper and
          // the installer agree on which entries are external and which
          // are not — drop unknown/missing sourceType rather than hand
          // them to `npx skills add`.
          const sourceType = (rawEntry as { sourceType?: unknown }).sourceType;
          if (sourceType === "local") continue;
          if (
            sourceType !== "github" &&
            sourceType !== "node_modules"
          ) {
            continue;
          }
          const source = (rawEntry as { source?: unknown }).source;
          if (typeof source !== "string" || source.length === 0) {
            continue;
          }
          if (!isStandardSkillsLayout(targetDir)) {
            // Off-layout: skip the npx-skills-add call; install.sh
            // handled internal skills already, external is the user's job.
            continue;
          }
          const extPath = join(targetDir, name);
          if (existsSync(extPath) && existsSync(join(extPath, "SKILL.md"))) {
            continue;
          }
          console.error(
            `Installing external skill '${name}' from '${source}' into '${targetDir}'…`,
          );
          if (npxPath === null) {
            console.error(
              `Error: cannot install external skill '${name}' — \`npx\` was not found on PATH. Install Node.js >=18 (which provides npx) or update PATH to include the directory containing it, then re-run the wrapper.`,
            );
            continue;
          }
          try {
            // npx skills add creates `<cwd>/.agents/skills/<name>` (and
            // `<cwd>/.claude/skills/<name>`), so the cwd must be TWO
            // directories above targetDir (which itself ends in
            // `/.agents/skills`) — `dirname` only strips one path segment.
            const npxCwd = dirname(dirname(targetDir));
            execFileSync(
              npxPath,
              [
                "-y",
                "skills@latest",
                "add",
                source,
                "--skill",
                name,
                "-y",
              ],
              {
                cwd: npxCwd,
                stdio: "inherit",
                // Pass a minimal env to `npx skills add` so secret-laden
                // process env vars (e.g. GH_TOKEN, AWS_*) never reach a
                // network-fetching child process. Mirrors the env-allowlist
                // pattern used by the bash wrapper.
                //
                // TMPDIR/TEMP/TMP reference publicly writable directories
                // but we only forward them to the child process — we never
                // create files in them ourselves, so there is no symlink-
                // attack or TOCTOU risk from this code path.  NOSONAR:
                // S5443.
                //
                // On Windows, .cmd/.bat scripts require shell: true to
                // execute (Node ≥22.6 enforces this per CVE-2024-27980).
                shell: process.platform === "win32",
                env: {
                  PATH: process.env.PATH,
                  HOME: process.env.HOME,
                  TMPDIR: process.env.TMPDIR, // NOSONAR S5443 — forwarded, not used directly
                  TEMP: process.env.TEMP, // NOSONAR S5443 — forwarded, not used directly
                  TMP: process.env.TMP, // NOSONAR S5443 — forwarded, not used directly
                  LANG: process.env.LANG,
                  LC_ALL: process.env.LC_ALL,
                  NO_COLOR: process.env.NO_COLOR,
                  FORCE_COLOR: process.env.FORCE_COLOR,
                  TERM: process.env.TERM,
                  HTTP_PROXY: process.env.HTTP_PROXY,
                  HTTPS_PROXY: process.env.HTTPS_PROXY,
                  NO_PROXY: process.env.NO_PROXY,
                  NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS,
                  NPM_CONFIG_REGISTRY: process.env.NPM_CONFIG_REGISTRY,
                  NPM_CONFIG_PROXY: process.env.NPM_CONFIG_PROXY,
                  NPM_CONFIG_HTTPS_PROXY: process.env.NPM_CONFIG_HTTPS_PROXY,
                } as NodeJS.ProcessEnv,
              },
            );
          } catch (err) {
            const e = err as ExecError;
            console.error(
              `Warning: failed to install external skill '${name}' from '${source}' (exit ${
                typeof e.status === "number" ? e.status : "non-zero"
              }). Continuing with internal skills only.`,
            );
            continue;
          }
          // Post-install check: verify the skill directory actually appeared
          // with a SKILL.md marker. npx skills add may exit 0 without
          // creating the expected path if the upstream CLI's per-agent
          // behaviour changed; without this check install.sh would later
          // fail the presence assertion.
          if (!existsSync(join(targetDir, name, "SKILL.md"))) {
            console.error(
              `Warning: external skill '${name}' was not installed into '${targetDir}' despite a zero exit code. Continuing with internal skills only.`,
            );
          }
        }
      }
    }
  }
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
