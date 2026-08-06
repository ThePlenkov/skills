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
