import * as fs from "node:fs";
import * as path from "node:path";
import { exec, fixOwnership, isCommandAvailable } from "./utils.ts";
import { scanners } from "./scanners/index.ts";
import type { RunContext, ScannerConfig, ScannerRunResult } from "./types.ts";

function redactCommand(parts: string[]): string {
  return parts
    .map((arg) => {
      if (arg.startsWith("GITHUB_TOKEN=") || /gh[pousr]_[A-Za-z0-9_]+/.test(arg)) {
        return "GITHUB_TOKEN=***";
      }
      return arg;
    })
    .join(" ");
}

async function runAct(scannerConfig: ScannerConfig, ctx: RunContext): Promise<ScannerRunResult> {
  const def = scanners.find((s) => s.name === scannerConfig.name);
  if (!def) throw new Error(`Unknown scanner: ${scannerConfig.name}`);
  const inputs = def.actInputs(scannerConfig, ctx);
  const args = ["act", "workflow_dispatch", "-W", def.workflow, "-C", ctx.repoDir, "--bind"];
  for (const [key, value] of Object.entries(inputs)) {
    args.push("--input", `${key}=${value}`);
  }
  if (ctx.dryRun) args.push("-n");
  if (ctx.verbose) args.push("--verbose");

  const env: Record<string, string> = { CODEQL_LOCAL_RUN: "true" };
  const actEnv = def.actEnv?.(scannerConfig, ctx) ?? {};
  for (const [key, value] of Object.entries(actEnv)) {
    args.push("--env", `${key}=${value}`);
    env[key] = value;
  }

  if (!ctx.dryRun && process.env.GITHUB_TOKEN) {
    args.push("-s", "GITHUB_TOKEN");
    env.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  }

  const start = Date.now();
  const code = await exec("gh", args, { cwd: ctx.repoDir, env, verbose: ctx.verbose, dryRun: ctx.dryRun });
  const durationMs = Date.now() - start;
  if (!ctx.dryRun) await fixOwnership(ctx.outputDir);

  const outputs = collectOutputs(ctx.outputDir);
  return {
    name: scannerConfig.name,
    backend: "act",
    exitCode: code,
    durationMs,
    outputs,
    commandSummary: `gh ${redactCommand(args)}`,
    errorMessage: code !== 0 ? `act runner exited with code ${code}` : undefined,
  };
}

function collectOutputs(outputDir: string): string[] {
  try {
    return fs
      .readdirSync(outputDir)
      .filter((f) => f.endsWith(".sarif"))
      .map((f) => path.relative(process.cwd(), path.join(outputDir, f)))
      .sort();
  } catch {
    return [];
  }
}

export async function runScanner(scannerConfig: ScannerConfig, ctx: RunContext): Promise<ScannerRunResult> {
  const def = scanners.find((s) => s.name === scannerConfig.name);
  if (!def) throw new Error(`Unknown scanner: ${scannerConfig.name}`);

  const mode = ctx.mode === "auto" ? (scannerConfig.mode ?? "auto") : ctx.mode;

  if (mode === "act") {
    return runAct(scannerConfig, ctx);
  }
  if (mode === "local") {
    const start = Date.now();
    const result = await def.runLocal(scannerConfig, ctx);
    result.durationMs = Date.now() - start;
    result.outputs = collectOutputs(ctx.outputDir);
    return result;
  }

  // auto
  if (isCommandAvailable("gh")) {
    const result = await runAct(scannerConfig, ctx);
    if (result.exitCode === 0) return result;
    console.error(`act runner exited with code ${result.exitCode}; falling back to local scanner CLI.`);
  }
  const start = Date.now();
  const result = await def.runLocal(scannerConfig, ctx);
  result.durationMs = Date.now() - start;
  result.outputs = collectOutputs(ctx.outputDir);
  return result;
}
