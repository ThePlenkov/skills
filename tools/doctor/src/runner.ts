import { exec, isCommandAvailable } from "./utils.ts";
import { scanners } from "./scanners/index.ts";
import type { RunContext, ScannerConfig } from "./types.ts";

async function runAct(scannerConfig: ScannerConfig, ctx: RunContext): Promise<number> {
  const def = scanners.find((s) => s.name === scannerConfig.name);
  if (!def) throw new Error(`Unknown scanner: ${scannerConfig.name}`);
  const inputs = def.actInputs(scannerConfig, ctx);
  const args = ["act", "workflow_dispatch", "-W", def.workflow, "-C", ctx.repoDir];
  for (const [key, value] of Object.entries(inputs)) {
    args.push("--input", `${key}=${value}`);
  }
  if (ctx.dryRun) args.push("-n");
  if (ctx.verbose) args.push("--verbose");
  if (!ctx.dryRun && process.env.GITHUB_TOKEN) args.push("-s", `GITHUB_TOKEN=${process.env.GITHUB_TOKEN}`);
  return exec("gh", args, { cwd: ctx.repoDir, env: { CODEQL_LOCAL_RUN: "true" }, verbose: ctx.verbose, dryRun: ctx.dryRun });
}

export async function runScanner(scannerConfig: ScannerConfig, ctx: RunContext): Promise<number> {
  const def = scanners.find((s) => s.name === scannerConfig.name);
  if (!def) throw new Error(`Unknown scanner: ${scannerConfig.name}`);

  const mode = ctx.mode === "auto" ? (scannerConfig.mode ?? "auto") : ctx.mode;

  if (mode === "act") {
    return runAct(scannerConfig, ctx);
  }
  if (mode === "local") {
    return def.runLocal(scannerConfig, ctx);
  }

  // auto
  if (isCommandAvailable("gh")) {
    const code = await runAct(scannerConfig, ctx);
    if (code === 0) return 0;
    console.error(`act runner exited with code ${code}; falling back to local scanner CLI.`);
  }
  return def.runLocal(scannerConfig, ctx);
}
