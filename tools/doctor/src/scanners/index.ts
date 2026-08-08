import { codeql } from "./codeql.ts";
import { githubScanners } from "./github.ts";
import type { ScannerDefinition } from "../types.ts";

export const scanners: ScannerDefinition[] = [codeql, ...githubScanners];
