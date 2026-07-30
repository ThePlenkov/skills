#!/usr/bin/env node
/**
 * Generate a human-readable skills index page with token counts and
 * default-enablement status.
 *
 * Token counts mirror the approximation Codex uses for its skills context
 * budget: ceil(byte_length / 4). This keeps the "Total description tokens"
 * line comparable to the 2% context-window budget.
 *
 * Usage:
 *   npx tsx scripts/generate-skills-index-md.ts [--output PATH] [--check] [--context-window N]
 *
 * Exits 0 on success; non-zero on validation errors or --check mismatch.
 */

import { parse as parseYaml } from "yaml";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import process from "node:process";
import { isNestedSkill } from "./lib/nested-skill.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILLS_DIR = join(ROOT, "skills");
const DEFAULT_OUTPUT = join(ROOT, "docs", "skills-index.md");
const APPROX_BYTES_PER_TOKEN = 4;
const DEFAULT_CONTEXT_WINDOW = 128_000;
const CONTEXT_PERCENT = 2;

type DefaultEnabled = "yes" | "no" | "partial" | "always";

interface SkillIndexEntry {
  name: string;
  category: string;
  tier: number;
  triggers: string[];
  description: string;
  descriptionTokens: number;
  totalTokens: number;
  path: string;
  disableModelInvocation: boolean;
  codexAllowImplicit: boolean;
  alwaysOn: boolean;
  claudeModelInvoked: boolean;
  codexImplicit: boolean;
  defaultEnabled: DefaultEnabled;
}

function approxTokenCount(text: string): number {
  const bytes = Buffer.byteLength(text, "utf8");
  return Math.ceil(bytes / APPROX_BYTES_PER_TOKEN);
}

function* walkSkillFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkSkillFiles(full);
    } else if (entry.name === "SKILL.md") {
      yield full;
    }
  }
}

function parseFrontmatter(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2 || lines[0].trim() !== "---") return {};
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) return {};
  const block = lines.slice(1, end).join("\n");
  const parsed = parseYaml(block);
  return typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, unknown>)
    : {};
}

function asList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const text = String(value).trim();
  if (!text) return [];
  if (text.includes(",")) return text.split(",").map((s) => s.trim()).filter(Boolean);
  return [text];
}

function getField(frontmatter: Record<string, unknown>, key: string): unknown {
  const metadata =
    frontmatter.metadata && typeof frontmatter.metadata === 'object' && !Array.isArray(frontmatter.metadata)
      ? (frontmatter.metadata as Record<string, unknown>)
      : undefined;
  return metadata?.[key] ?? frontmatter[key];
}

function readCodexPolicy(skillDir: string): boolean {
  const file = join(skillDir, "agents", "openai.yaml");
  if (!existsSync(file)) return true;
  try {
    const text = readFileSync(file, "utf-8");
    const parsed = parseYaml(text);
    if (typeof parsed === "object" && parsed !== null) {
      const root = parsed as Record<string, unknown>;
      const policy =
        typeof root.policy === "object" && root.policy !== null
          ? (root.policy as Record<string, unknown>)
          : undefined;
      if (policy && "allow_implicit_invocation" in policy) {
        return policy.allow_implicit_invocation !== false;
      }
    }
  } catch {
    // Malformed YAML is treated as if the policy is not set.
  }
  return true;
}

function deriveDefaultEnabled(entry: {
  alwaysOn: boolean;
  claudeModelInvoked: boolean;
  codexImplicit: boolean;
}): DefaultEnabled {
  if (entry.alwaysOn) return "always";
  if (entry.claudeModelInvoked && entry.codexImplicit) return "yes";
  if (!entry.claudeModelInvoked && !entry.codexImplicit) return "no";
  return "partial";
}

function loadSkills(): SkillIndexEntry[] {
  const entries: SkillIndexEntry[] = [];

  for (const skillFile of walkSkillFiles(SKILLS_DIR)) {
    if (isNestedSkill(skillFile, SKILLS_DIR)) continue;

    const text = readFileSync(skillFile, "utf-8");
    const frontmatter = parseFrontmatter(text);
    const relPath = relative(ROOT, skillFile).replace(/\\/g, "/");
    const parts = relPath.split("/");
    const category = parts.length >= 3 ? parts[1] : "";
    const name = String(frontmatter.name ?? "");
    const description = String(frontmatter.description ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const triggers = asList(getField(frontmatter, "triggers"));
    const tier = Number(getField(frontmatter, "tier") ?? 2);
    const disableModelInvocation = getField(frontmatter, "disable-model-invocation") === true;
    const codexAllowImplicit = readCodexPolicy(dirname(skillFile));
    const alwaysOn = triggers.includes("always");
    const claudeModelInvoked =
      alwaysOn || (triggers.includes("model") && !disableModelInvocation);
    const codexImplicit =
      alwaysOn || (triggers.includes("model") && codexAllowImplicit);

    entries.push({
      name,
      category,
      tier,
      triggers,
      description,
      descriptionTokens: approxTokenCount(description),
      totalTokens: approxTokenCount(text),
      path: relPath,
      disableModelInvocation,
      codexAllowImplicit,
      alwaysOn,
      claudeModelInvoked,
      codexImplicit,
      defaultEnabled: deriveDefaultEnabled({
        alwaysOn,
        claudeModelInvoked,
        codexImplicit,
      }),
    });
  }

  return entries.sort((a, b) =>
    a.category === b.category
      ? a.name.localeCompare(b.name)
      : a.category.localeCompare(b.category),
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function generateMarkdown(skills: SkillIndexEntry[], contextWindow: number): string {
  const totalDescriptionTokens = skills.reduce(
    (sum, s) => sum + s.descriptionTokens,
    0,
  );
  const totalTokens = skills.reduce((sum, s) => sum + s.totalTokens, 0);
  const budgetTokens = Math.floor((contextWindow * CONTEXT_PERCENT) / 100);
  const overflow = totalDescriptionTokens / budgetTokens;

  const byCategory = new Map<string, SkillIndexEntry[]>();
  for (const skill of skills) {
    if (!byCategory.has(skill.category)) byCategory.set(skill.category, []);
    byCategory.get(skill.category)!.push(skill);
  }
  const categories = [...byCategory.keys()].sort();

  let output = "# Skills Index\n\n";
  output +=
    "Auto-generated from skill frontmatter. ";
  output +=
    "Run `npx tsx scripts/generate-skills-index-md.ts` to regenerate.\n\n";

  output += "## Summary\n\n";
  output += `- **Total skills:** ${skills.length}\n`;
  output += `- **Context window (default):** ${formatNumber(contextWindow)} tokens\n`;
  output += `- **Skills metadata budget (2%):** ${formatNumber(budgetTokens)} tokens\n`;
  output += `- **Total description tokens:** ${formatNumber(totalDescriptionTokens)} tokens\n`;
  output += `- **Overflow vs. 2% budget:** ${overflow.toFixed(2)}x\n`;
  output += `- **Total skill file tokens:** ${formatNumber(totalTokens)} tokens\n\n`;

  output +=
    "Token counts use the same approximation Codex uses for its skills ";
  output +=
    "context budget: `ceil(byte_length / 4)`.\n\n";

  output += "## By category\n\n";
  output += "| Category | Skills | Description tokens | Total tokens |\n";
  output += "| --- | --- | --- | --- |\n";
  for (const category of categories) {
    const list = byCategory.get(category)!;
    const catDescriptionTokens = list.reduce(
      (sum, s) => sum + s.descriptionTokens,
      0,
    );
    const catTotalTokens = list.reduce((sum, s) => sum + s.totalTokens, 0);
    output += `| ${category} | ${list.length} | ${formatNumber(catDescriptionTokens)} | ${formatNumber(catTotalTokens)} |\n`;
  }

  output += "\n## Skill catalog\n\n";
  output +=
    "| Skill | Category | Tier | Default enabled | Description tokens | Total tokens | Triggers | Claude model | Codex implicit |\n";
  output +=
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n";
  for (const skill of skills) {
    const nameLink = `[\`${skill.name}\`](${skill.path})`;
    const triggers = skill.triggers.join(", ") || "—";
    const claude = skill.claudeModelInvoked ? "yes" : "no";
    const codex = skill.codexImplicit ? "yes" : "no";
    output +=
      `| ${nameLink} | ${skill.category} | ${skill.tier} | ${skill.defaultEnabled} | ${formatNumber(skill.descriptionTokens)} | ${formatNumber(skill.totalTokens)} | ${triggers} | ${claude} | ${codex} |\n`;
  }

  output += "\n## Definitions\n\n";
  output +=
    "- **Description tokens:** Approximate token count of the `description` frontmatter field (the metadata loaded into the agent context).\n";
  output +=
    "- **Total tokens:** Approximate token count of the entire `SKILL.md` file.\n";
  output +=
    "- **Default enabled:** Whether the skill is visible to the model without an explicit user invocation.\n";
  output += "  - `yes`: loaded by default in both Claude/Cursor and Codex.\n";
  output += "  - `no`: explicit-only (user must type the skill name).\n";
  output +=
    "  - `partial`: loaded by default in one tool but blocked in another.\n";
  output += "  - `always`: Tier 0 always-on skill.\n";
  output +=
    "- **Claude model:** `yes` unless `disable-model-invocation: true` or the skill is user-only.\n";
  output +=
    "- **Codex implicit:** `yes` unless `agents/openai.yaml` sets `allow_implicit_invocation: false` or the skill is user-only.\n";

  return output;
}

const { values } = parseArgs({
  options: {
    output: { type: "string", default: DEFAULT_OUTPUT },
    check: { type: "boolean", default: false },
    "context-window": { type: "string", default: String(DEFAULT_CONTEXT_WINDOW) },
    help: { type: "boolean", short: "h", default: false },
  },
  allowPositionals: false,
});

if (values.help) {
  console.error(
    "Usage: npx tsx scripts/generate-skills-index-md.ts [--output PATH] [--check] [--context-window N]",
  );
  process.exit(0);
}

const contextWindow = Number(values["context-window"]);
if (!Number.isInteger(contextWindow) || contextWindow <= 0) {
  console.error(`error: invalid context window: ${values["context-window"]}`);
  process.exit(1);
}

const skills = loadSkills();
const generated = generateMarkdown(skills, contextWindow);

if (values.check) {
  if (!existsSync(values.output)) {
    console.error(
      `error: ${values.output} does not exist; run without --check to generate`,
    );
    process.exit(1);
  }
  const existing = readFileSync(values.output, "utf-8");
  if (existing.replace(/\r\n/g, "\n") !== generated.replace(/\r\n/g, "\n")) {
    console.error(`error: ${values.output} is out of sync with skill frontmatter`);
    console.error(
      "Run 'npx tsx scripts/generate-skills-index-md.ts' to regenerate.",
    );
    process.exit(1);
  }
  console.log(`✅ ${values.output} is in sync.`);
  process.exit(0);
}

writeFileSync(values.output, generated, "utf-8");
console.log(`wrote ${skills.length} skills to ${values.output}`);
