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

export interface ScannerRunResult {
  name: string;
  backend: "act" | "local" | "unknown";
  exitCode: number;
  durationMs: number;
  outputs: string[];
  commandSummary: string;
  errorMessage?: string;
}

export interface FindingSummary {
  scanner: string;
  file: string;
  totalResults: number;
  byRule: Record<string, number>;
  byLevel: Record<string, number>;
}

export interface DoctorReport {
  repoDir: string;
  timestamp: string;
  mode: "auto" | "act" | "local";
  outputDir: string;
  scanners: ScannerRunResult[];
  findings: FindingSummary[];
}

export interface ScannerDefinition {
  name: string;
  workflow: string;
  actInputs(config: ScannerConfig, ctx: RunContext): Record<string, string>;
  actEnv?(config: ScannerConfig, ctx: RunContext): Record<string, string>;
  runLocal(config: ScannerConfig, ctx: RunContext): Promise<ScannerRunResult>;
}
