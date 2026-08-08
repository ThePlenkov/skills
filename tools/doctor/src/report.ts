import * as fs from "node:fs";
import * as path from "node:path";
import type { DoctorReport, FindingSummary, RunContext, ScannerRunResult } from "./types.ts";

interface SarifResult {
  ruleId?: string;
  level?: string;
  message?: { text?: string; markdown?: string };
}

interface SarifRun {
  results?: SarifResult[];
  tool?: { driver?: { name?: string } };
}

interface SarifDocument {
  runs?: SarifRun[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem > 0 ? `${minutes}m ${rem}s` : `${minutes}m`;
}

function summarizeSarif(filePath: string): FindingSummary | undefined {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
  let sarif: SarifDocument;
  try {
    sarif = JSON.parse(content) as SarifDocument;
  } catch {
    return undefined;
  }
  const run = sarif.runs?.[0];
  const results = run?.results ?? [];
  const byRule: Record<string, number> = {};
  const byLevel: Record<string, number> = {};
  for (const result of results) {
    const id = result.ruleId ?? "unknown";
    byRule[id] = (byRule[id] ?? 0) + 1;
    const level = result.level ?? "warning";
    byLevel[level] = (byLevel[level] ?? 0) + 1;
  }
  return {
    scanner: run?.tool?.driver?.name ?? path.basename(filePath, ".sarif"),
    file: filePath,
    totalResults: results.length,
    byRule,
    byLevel,
  };
}

function summarizeReportJson(filePath: string): FindingSummary | undefined {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(content) as Partial<FindingSummary>;
    if (typeof parsed.totalResults !== "number") return undefined;
    return {
      scanner: parsed.scanner ?? path.basename(filePath, ".json"),
      file: parsed.file ?? filePath,
      totalResults: parsed.totalResults,
      byRule: parsed.byRule ?? {},
      byLevel: parsed.byLevel ?? {},
      details: parsed.details,
    };
  } catch {
    return undefined;
  }
}

function summarizeFile(filePath: string): FindingSummary | undefined {
  if (filePath.endsWith(".sarif")) return summarizeSarif(filePath);
  if (filePath.endsWith(".json")) return summarizeReportJson(filePath);
  return undefined;
}

export function buildReport(ctx: RunContext, scannerResults: ScannerRunResult[]): DoctorReport {
  const timestamp = new Date().toISOString();
  const findings: FindingSummary[] = [];
  const files = new Set(scannerResults.flatMap((r) => r.outputs));
  for (const file of [...files].sort()) {
    if (!fs.existsSync(file)) continue;
    const summary = summarizeFile(file);
    if (summary) findings.push(summary);
  }

  return {
    repoDir: ctx.repoDir,
    timestamp,
    mode: ctx.mode,
    outputDir: ctx.outputDir,
    scanners: scannerResults,
    findings,
  };
}

export function reportToMarkdown(report: DoctorReport): string {
  const lines: string[] = [];
  const outputRel = path.relative(report.repoDir, report.outputDir) || ".doctor";

  lines.push("# Doctor Scan Report");
  lines.push("");
  lines.push(`- **Repository**: ${report.repoDir}`);
  lines.push(`- **Scanned at**: ${report.timestamp}`);
  lines.push(`- **Mode**: ${report.mode}`);
  lines.push(`- **Output directory**: ${outputRel}`);
  lines.push("");

  lines.push("## Scan checklist");
  lines.push("");
  lines.push("| Scanner | Backend | Status | Duration |");
  lines.push("| --- | --- | --- | --- |");
  for (const scanner of report.scanners) {
    let status: string;
    if (scanner.skipped) {
      status = scanner.skipReason ? `⏭️ skipped (${scanner.skipReason})` : "⏭️ skipped";
    } else if (scanner.exitCode === 0) {
      status = "✅ passed";
    } else {
      status = `❌ failed (${scanner.exitCode})`;
    }
    lines.push(`| ${scanner.name} | ${scanner.backend} | ${status} | ${formatDuration(scanner.durationMs)} |`);
  }
  lines.push("");

  const failedScanners = report.scanners.filter((s) => !s.skipped && s.exitCode !== 0 && s.errorMessage);
  if (failedScanners.length > 0) {
    lines.push("## Execution notes");
    lines.push("");
    for (const scanner of failedScanners) {
      lines.push(`- **${scanner.name}**: ${scanner.errorMessage}`);
    }
    lines.push("");
  }

  const totalFindings = report.findings.reduce((sum, f) => sum + f.totalResults, 0);
  if (totalFindings === 0) {
    lines.push("## Findings summary");
    lines.push("");
    lines.push("No findings were produced by the configured scanners.");
    lines.push("");
  } else {
    lines.push("## Findings summary");
    lines.push("");
    lines.push(`**Total findings**: ${totalFindings}`);
    lines.push("");
    for (const finding of report.findings) {
      const fileRel = finding.file.startsWith(report.repoDir) ? finding.file.slice(report.repoDir.length + 1) : finding.file;
      lines.push(`### ${finding.scanner} — \`${fileRel}\``);
      lines.push("");
      lines.push(`- **Results**: ${finding.totalResults}`);
      if (Object.keys(finding.byLevel).length > 0) {
        const levelText = Object.entries(finding.byLevel)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([level, count]) => `${level}: ${count}`)
          .join(", ");
        lines.push(`- **By level**: ${levelText}`);
      }
      if (Object.keys(finding.byRule).length > 0) {
        lines.push("- **By rule**:");
        const ruleEntries = Object.entries(finding.byRule).sort(([, a], [, b]) => b - a);
        for (const [rule, count] of ruleEntries) {
          lines.push(`  - \`${rule}\`: ${count}`);
        }
      }
      if (finding.details && finding.details.length > 0) {
        lines.push("- **Details**:");
        for (const detail of finding.details.slice(0, 20)) {
          lines.push(`  - ${detail}`);
        }
        if (finding.details.length > 20) {
          lines.push(`  - ... and ${finding.details.length - 20} more`);
        }
      }
      lines.push("");
    }
  }

  lines.push("## Raw output files");
  lines.push("");
  if (report.findings.length === 0) {
    lines.push("No output files were generated.");
  } else {
    for (const finding of report.findings) {
      const rel = finding.file.startsWith(report.repoDir) ? finding.file.slice(report.repoDir.length + 1) : finding.file;
      const stats = fs.statSync(finding.file);
      lines.push(`- \`${rel}\` (${formatBytes(stats.size)})`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

export function writeReport(report: DoctorReport): string {
  const reportPath = path.join(report.outputDir, "doctor-report.md");
  fs.mkdirSync(report.outputDir, { recursive: true });
  fs.writeFileSync(reportPath, reportToMarkdown(report), "utf8");
  return reportPath;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function printReportSummary(report: DoctorReport): void {
  const outputRel = path.relative(report.repoDir, report.outputDir) || ".doctor";
  console.log(`\n▶ Doctor report written to ${outputRel}/doctor-report.md`);
  const totalFindings = report.findings.reduce((sum, f) => sum + f.totalResults, 0);
  console.log(`  Total findings: ${totalFindings}`);
  for (const scanner of report.scanners) {
    if (scanner.skipped) {
      console.log(`  ⏭️ ${scanner.name} (${scanner.backend}) — skipped: ${scanner.skipReason ?? ""}`);
      continue;
    }
    const status = scanner.exitCode === 0 ? "✅" : "❌";
    console.log(`  ${status} ${scanner.name} (${scanner.backend}) — ${formatDuration(scanner.durationMs)}`);
    if (!scanner.skipped && scanner.exitCode !== 0 && scanner.errorMessage) {
      console.log(`    error: ${scanner.errorMessage}`);
    }
    for (const finding of report.findings.filter((f) => f.scanner.toLowerCase() === scanner.name || f.file.toLowerCase().includes(scanner.name))) {
      console.log(`    - ${path.basename(finding.file)}: ${finding.totalResults} finding${finding.totalResults === 1 ? "" : "s"}`);
    }
  }
}
