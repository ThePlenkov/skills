export interface ScannerConfig {
  name: string;
  enabled?: boolean;
  mode?: "auto" | "act" | "local";
  languages?: string[];
  queries?: string;
  outputDir?: string;
  upload?: "always" | "failure-only" | "never";
  [key: string]: unknown;
}

export interface DoctorConfig {
  outputDir?: string;
  mode?: "auto" | "act" | "local";
  scanners?: ScannerConfig[];
  [key: string]: unknown;
}

export interface RunContext {
  repoDir: string;
  outputDir: string;
  mode: "auto" | "act" | "local";
  dryRun: boolean;
  verbose: boolean;
}

export interface ScannerDefinition {
  name: string;
  workflow: string;
  actInputs(config: ScannerConfig, ctx: RunContext): Record<string, string>;
  actEnv?(config: ScannerConfig, ctx: RunContext): Record<string, string>;
  runLocal(config: ScannerConfig, ctx: RunContext): Promise<number>;
}
