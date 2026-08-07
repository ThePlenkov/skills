import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, spawnSync } from "node:child_process";

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  verbose?: boolean;
  dryRun?: boolean;
}

function redactArg(arg: string): string {
  if (arg.startsWith("-s ") || arg.startsWith("-s")) {
    return arg.replace(/^(.*=).*$/, "$1***");
  }
  if (arg.includes("GITHUB_TOKEN=") || /gh[pousr]_[A-Za-z0-9_]+/.test(arg)) {
    return "***";
  }
  return arg.includes(" ") ? `"${arg}"` : arg;
}

export function exec(command: string, args: string[], options: ExecOptions = {}): Promise<number> {
  if (options.dryRun) {
    console.log(`[dry-run] ${command} ${args.map(redactArg).join(" ")}`);
    return Promise.resolve(0);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: options.verbose ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    if (!options.verbose) {
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
    }
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0 && !options.verbose) {
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
      }
      resolve(code ?? 0);
    });
  });
}

export function isCommandAvailable(name: string): boolean {
  const result = spawnSync(name, ["--version"], { stdio: "ignore" });
  return result.error === undefined && result.status === 0;
}

export async function fixOwnership(target: string): Promise<void> {
  if (typeof process.getuid !== "function" || typeof process.getgid !== "function") return;
  if (!isCommandAvailable("docker")) return;
  const uid = process.getuid();
  const gid = process.getgid();
  const abs = path.resolve(target);
  await new Promise<void>((resolve) => {
    const child = spawn("docker", ["run", "--rm", "-v", `${abs}:${abs}`, "alpine", "chown", "-R", `${uid}:${gid}`, abs], { stdio: "ignore" });
    child.on("error", () => resolve());
    child.on("exit", () => resolve());
  });
}

interface SarifResult {
  ruleId?: string;
  message?: { text?: string; markdown?: string };
}

interface SarifRun {
  results?: SarifResult[];
  tool?: { driver?: { rules?: Array<{ id?: string; name?: string; shortDescription?: { text?: string } }> } };
}

interface SarifDocument {
  runs?: SarifRun[];
}

export function summarizeOutput(outputDir: string): void {
  const files = fs.readdirSync(outputDir).filter((f) => f.endsWith(".sarif"));
  if (files.length === 0) return;
  console.log(`\n▶ Scan results in ${path.relative(process.cwd(), outputDir) || outputDir}:`);
  for (const file of files.sort()) {
    const content = fs.readFileSync(path.join(outputDir, file), "utf8");
    let sarif: SarifDocument;
    try {
      sarif = JSON.parse(content) as SarifDocument;
    } catch {
      continue;
    }
    const results = sarif.runs?.[0]?.results ?? [];
    const ruleIndex = new Map<string, number>();
    for (const result of results) {
      const id = result.ruleId ?? "unknown";
      ruleIndex.set(id, (ruleIndex.get(id) ?? 0) + 1);
    }
    console.log(`  ${file}: ${results.length} finding${results.length === 1 ? "" : "s"}`);
    for (const [id, count] of ruleIndex) {
      console.log(`    - ${id}: ${count}`);
    }
  }
}
