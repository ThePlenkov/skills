import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { exec, isCommandAvailable } from "../utils.ts";
import type { RunContext, ScannerConfig, ScannerDefinition, ScannerRunResult } from "../types.ts";

const KNOWN_SUITES = new Set(["default", "code-scanning", "security-extended", "security-and-quality"]);

function normalizeLanguage(language: string): string {
  const lang = language.toLowerCase().replace(/[#+]/g, "");
  switch (lang) {
    case "typescript":
    case "javascript-typescript":
      return "javascript";
    case "c":
      return "cpp";
    case "c#":
      return "csharp";
    default:
      return lang;
  }
}

function normalizeLanguages(languages: string[]): string[] {
  return [...new Set(languages.map(normalizeLanguage))];
}

function resolveQuery(language: string, queries: string): string[] {
  const parts = queries.split(",").map((q) => q.trim()).filter(Boolean);
  return parts.flatMap((part) => resolveQueryPart(language, part));
}

function resolveQueryPart(language: string, part: string): string[] {
  if (part.includes(":") || part.includes("/") || part.endsWith(".qls") || part.endsWith(".ql")) {
    return [part];
  }
  if (!KNOWN_SUITES.has(part)) {
    return [part];
  }
  if (part === "default") {
    return [`codeql/${language}-queries`];
  }
  return [`codeql/${language}-queries:codeql-suites/${language}-${part}.qls`];
}

export const codeql: ScannerDefinition = {
  name: "codeql",
  workflow: fileURLToPath(new URL("../../templates/codeql.yml", import.meta.url)),
  actEnv() {
    return { CODEQL_ACTION_ANALYSIS_KEY: "security-doctor:analyze" };
  },
  actInputs(config, ctx) {
    const outputDir = path.relative(ctx.repoDir, path.resolve(ctx.repoDir, (config.outputDir as string) ?? ctx.outputDir));
    return {
      languages: (config.languages ?? ["javascript", "typescript"]).join(","),
      queries: (config.queries ?? "security-extended") as string,
      output_dir: outputDir || ".doctor",
      upload: (config.upload ?? "never") as string,
      config_file: (config.config_file ?? "") as string,
      ram: (config.ram ?? "4096") as string,
    };
  },
  async runLocal(config, ctx): Promise<ScannerRunResult> {
    const languages = normalizeLanguages((config.languages as string[]) ?? ["javascript", "typescript"]);
    const queries = (config.queries as string) ?? "security-extended";
    const outputDir = path.resolve(ctx.outputDir);
    const sourceRoot = path.resolve(ctx.repoDir);
    const commandSummary = `codeql database create/analyze (${languages.join(", ")}) → ${outputDir}/codeql-<language>.sarif`;

    if (!isCommandAvailable("codeql")) {
      throw new Error(
        "CodeQL local runner requires the `codeql` CLI. " +
        "Install it from https://github.com/github/codeql-cli-binaries or run with `act` (auto mode) instead.",
      );
    }

    let exitCode = 0;
    const outputs: string[] = [];
    for (const language of languages) {
      const dbDir = path.join(outputDir, `codeql-db-${language}`);
      let code = await exec("codeql", ["database", "create", dbDir, "--source-root", sourceRoot, "--language", language, "--overwrite"], {
        cwd: ctx.repoDir,
        verbose: ctx.verbose,
        dryRun: ctx.dryRun,
      });
      if (code !== 0) {
        exitCode = code;
        break;
      }
      const queryArgs = resolveQuery(language, queries);
      const sarif = path.join(outputDir, `codeql-${language}.sarif`);
      code = await exec("codeql", ["database", "analyze", dbDir, ...queryArgs, "--format", "sarif-latest", "--output", sarif], {
        cwd: ctx.repoDir,
        verbose: ctx.verbose,
        dryRun: ctx.dryRun,
      });
      if (code === 0) {
        outputs.push(path.relative(process.cwd(), sarif));
      } else {
        exitCode = code;
        break;
      }
    }

    return {
      name: "codeql",
      backend: "local",
      exitCode,
      durationMs: 0,
      outputs,
      commandSummary,
      errorMessage: exitCode !== 0 ? `codeql local run exited with code ${exitCode}` : undefined,
    };
  },
};
