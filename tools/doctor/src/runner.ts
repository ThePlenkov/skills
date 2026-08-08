import * as fs from "node:fs";
import * as path from "node:path";
import { exec, fixOwnership, isCommandAvailable } from "./utils.ts";
import { scanners } from "./scanners/index.ts";
import type { RunContext, ScannerConfig, ScannerDefinition, ScannerRunResult } from "./types.ts";

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
  if (!def.workflow || !def.actInputs) {
    throw new Error(`Scanner ${scannerConfig.name} cannot run via act`);
  }
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

  const outputs = ctx.dryRun ? [] : collectOutputs(ctx.outputDir);
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
      .filter((f) => f.endsWith(".sarif") || f.endsWith(".json"))
      .map((f) => path.relative(process.cwd(), path.join(outputDir, f)))
      .sort();
  } catch {
    return [];
  }
}

async function runLocal(scannerConfig: ScannerConfig, def: ScannerDefinition, ctx: RunContext): Promise<ScannerRunResult> {
  const start = Date.now();
  const result = await def.runLocal(scannerConfig, ctx);
  result.durationMs = Date.now() - start;
  if (result.outputs.length === 0 && !ctx.dryRun) {
    result.outputs = collectOutputs(ctx.outputDir);
  }
  return result;
}

export async function runScanner(scannerConfig: ScannerConfig, ctx: RunContext): Promise<ScannerRunResult> {
  const def = scanners.find((s) => s.name === scannerConfig.name);
  if (!def) throw new Error(`Unknown scanner: ${scannerConfig.name}`);

  if (ctx.mode === "act") {
    if (!def.workflow) {
      console.log(`Scanner ${scannerConfig.name} does not support act; running locally.`);
      return runLocal(scannerConfig, def, ctx);
    }
    return runAct(scannerConfig, ctx);
  }

  if (ctx.mode === "local") {
    return runLocal(scannerConfig, def, ctx);
  }

  // auto
  if (isCommandAvailable("gh") && def.workflow) {
    const result = await runAct(scannerConfig, ctx);
    if (result.exitCode === 0) return result;
    console.error(`act runner exited with code ${result.exitCode}; falling back to local scanner CLI.`);
  }

  return runLocal(scannerConfig, def, ctx);
}
