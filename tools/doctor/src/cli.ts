import * as path from "node:path";
import { loadConfig } from "./config.ts";
import { runScanner } from "./runner.ts";
import { scanners } from "./scanners/index.ts";
import { buildReport, printReportSummary, writeReport } from "./report.ts";
import type { DoctorConfig, RunContext, ScannerConfig, ScannerRunResult } from "./types.ts";

function usage() {
  console.log(`
doctor - run security scanners from GitHub Actions templates

Usage:
  doctor [command] [options] [repo]

Commands:
  scan          Run all configured scanners (default)
  run <name>    Run a single scanner by name
  list          List available scanners

Options:
  -c, --config   Path to doctor config file
  -m, --mode     Runner mode: auto | act | local (default: auto)
  -o, --output   Output directory for scan artifacts
  -n, --dry-run  Show what would be run without executing containers
  -v, --verbose  Stream full command output
  -h, --help     Show this help

Config files (searched in repo order):
  doctor.config.ts, doctor.config.js, doctor.config.yaml, doctor.config.yml, doctor.config.json
`.trim());
}

function parseArgs(argv: string[]) {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "-c" || arg === "--config") {
      options.config = argv[++i];
    } else if (arg === "-m" || arg === "--mode") {
      options.mode = argv[++i];
    } else if (arg === "-o" || arg === "--output") {
      options.output = argv[++i];
    } else if (arg === "-n" || arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "-v" || arg === "--verbose") {
      options.verbose = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (!arg.startsWith("-")) {
      positionals.push(arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
    i++;
  }
  return { positionals, options };
}

function isValidMode(mode: string): mode is "auto" | "act" | "local" {
  return ["auto", "act", "local"].includes(mode);
}

function resolveScanners(config: DoctorConfig, command: string, scannerName?: string): ScannerConfig[] {
  if (command === "run") {
    if (!scannerName) {
      console.error("Usage: doctor run <scanner>");
      process.exit(1);
    }
    const fromConfig = config.scanners?.find((s) => s.name === scannerName);
    return [fromConfig ?? { name: scannerName }];
  }
  const configured = config.scanners?.filter((s) => s.enabled !== false);
  if (!configured || configured.length === 0) {
    return [{ name: "codeql" }];
  }
  return configured;
}

async function main() {
  const { positionals, options } = parseArgs(process.argv.slice(2));

  if (options.help) {
    usage();
    process.exit(0);
  }

  let command = "scan";
  let repoArgIndex = 0;
  let scannerName: string | undefined;
  if (positionals[0] === "scan") {
    command = "scan";
    repoArgIndex = 1;
  } else if (positionals[0] === "run") {
    command = "run";
    scannerName = positionals[1];
    repoArgIndex = 2;
  } else if (positionals[0] === "list") {
    command = "list";
  } else if (positionals[0] === "--help" || positionals[0] === "-h") {
    usage();
    process.exit(0);
  } else if (positionals[0]) {
    command = "scan";
    repoArgIndex = 0;
  }

  if (command === "list") {
    console.log("Available scanners:");
    for (const scanner of scanners) {
      console.log(`  - ${scanner.name}`);
    }
    process.exit(0);
  }

  const repoDir = path.resolve(positionals[repoArgIndex] ?? process.cwd());

  const rawMode = (options.mode as string) ?? "auto";
  if (!isValidMode(rawMode)) {
    console.error(`Invalid mode: ${rawMode}`);
    process.exit(1);
  }

  const config = await loadConfig(options.config as string | undefined, repoDir);
  const mode = (options.mode as string | undefined) ?? config.mode ?? "auto";
  if (!isValidMode(mode)) {
    console.error(`Invalid mode in config: ${mode}`);
    process.exit(1);
  }
  const outputDir = path.resolve(repoDir, (options.output as string) ?? config.outputDir ?? ".doctor");

  const ctx: RunContext = {
    repoDir,
    outputDir,
    mode,
    dryRun: options.dryRun === true,
    verbose: options.verbose === true,
  };

  const scannerConfigs = resolveScanners(config, command, scannerName);

  const scannerResults: ScannerRunResult[] = [];
  let exitCode = 0;
  for (const scannerConfig of scannerConfigs) {
    console.log(`\n▶ Running scanner: ${scannerConfig.name} (mode: ${ctx.mode})`);
    const result = await runScanner(scannerConfig, ctx);
    scannerResults.push(result);
    if (result.exitCode !== 0) {
      console.error(`Scanner ${scannerConfig.name} exited with code ${result.exitCode}`);
      if (result.errorMessage) console.error(result.errorMessage);
      exitCode = result.exitCode;
    }
  }

  const report = buildReport(ctx, scannerResults);
  const reportPath = writeReport(report);
  printReportSummary(report);
  console.log(`\nFull report: ${reportPath}`);

  process.exit(exitCode);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
