import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { exec, isCommandAvailable } from "../utils.ts";
import type { RunContext, ScannerConfig, ScannerDefinition } from "../types.ts";

const CODEQL_IMAGE = "mcr.microsoft.com/cstsectools/codeql-container";

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
  async runLocal(config, ctx) {
    const languages = normalizeLanguages((config.languages as string[]) ?? ["javascript", "typescript"]);
    const queries = (config.queries as string) ?? "security-extended";
    const outputDir = path.resolve(ctx.outputDir);
    const sourceRoot = path.resolve(ctx.repoDir);

    if (isCommandAvailable("codeql")) {
      for (const language of languages) {
        const dbDir = path.join(outputDir, `codeql-db-${language}`);
        let code = await exec("codeql", ["database", "create", dbDir, "--source-root", sourceRoot, "--language", language, "--overwrite"], {
          cwd: ctx.repoDir,
          verbose: ctx.verbose,
          dryRun: ctx.dryRun,
        });
        if (code !== 0) return code;
        const queryArgs = resolveQuery(language, queries);
        const sarif = path.join(outputDir, `codeql-${language}.sarif`);
        code = await exec("codeql", ["database", "analyze", dbDir, ...queryArgs, "--format", "sarif-latest", "--output", sarif], {
          cwd: ctx.repoDir,
          verbose: ctx.verbose,
          dryRun: ctx.dryRun,
        });
        if (code !== 0) return code;
      }
      return 0;
    }

    if (isCommandAvailable("docker")) {
      for (const language of languages) {
        const queryArgs = resolveQuery(language, queries);
        const dbDir = `/opt/results/codeql-db-${language}`;
        const createArgs = `codeql database create ${dbDir} --source-root=/opt/src --language=${language} --overwrite`;
        let code = await exec("docker", [
          "run",
          "--rm",
          "-v",
          `${sourceRoot}:/opt/src`,
          "-v",
          `${outputDir}:/opt/results`,
          "-e",
          `CODEQL_CLI_ARGS=${createArgs}`,
          CODEQL_IMAGE,
        ], { cwd: ctx.repoDir, verbose: ctx.verbose, dryRun: ctx.dryRun });
        if (code !== 0) return code;

        const analyzeArgs = `codeql database analyze ${dbDir} ${queryArgs.join(" ")} --format=sarif-latest --output=${dbDir}.sarif`;
        code = await exec("docker", [
          "run",
          "--rm",
          "-v",
          `${sourceRoot}:/opt/src`,
          "-v",
          `${outputDir}:/opt/results`,
          "-e",
          `CODEQL_CLI_ARGS=${analyzeArgs}`,
          CODEQL_IMAGE,
        ], { cwd: ctx.repoDir, verbose: ctx.verbose, dryRun: ctx.dryRun });
        if (code !== 0) return code;
      }
      return 0;
    }

    throw new Error(
      "CodeQL local runner requires either the `codeql` CLI or `docker`. " +
      "Install CodeQL CLI from https://github.com/github/codeql-cli-binaries or install Docker.",
    );
  },
};
