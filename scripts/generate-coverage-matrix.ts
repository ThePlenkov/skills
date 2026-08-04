import { parse as parseYaml } from "yaml";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import process from "node:process";
import { isNestedSkill } from "./lib/nested-skill.js";
import { getField, mergeConfigFrontmatter } from "./lib/skill-frontmatter.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILLS_DIR = join(ROOT, "skills");
const OUTPUT = join(ROOT, "docs", "skill-coverage-matrix.md");

interface Skill {
  name: string;
  category: string;
  description: string;
  tier: number;
  triggers: string[];
  conflicts_with: string[];
  depends_on: string[];
  path: string;
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
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

function asList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const text = String(value).trim();
  if (!text) return [];
  if (text.includes(",")) return text.split(",").map((s) => s.trim()).filter(Boolean);
  return [text];
}

function loadSkills(): Skill[] {
  const skills: Skill[] = [];
  for (const skillFile of walkSkillFiles(SKILLS_DIR)) {
    if (isNestedSkill(skillFile, SKILLS_DIR)) continue;
    const text = readFileSync(skillFile, "utf-8");
    const rawFrontmatter = parseFrontmatter(text);
    const name = String(rawFrontmatter.name ?? "");
    if (!name) {
      throw new Error(`SKILL.md at ${skillFile} is missing a name`);
    }
    const frontmatter = mergeConfigFrontmatter(name, rawFrontmatter);
    const relPath = relative(ROOT, skillFile).replace(/\\/g, "/");
    const parts = relPath.split("/");
    const category = parts.length >= 3 ? parts[1] : "";
    const tier = getField(frontmatter, "tier");
    const triggers = getField(frontmatter, "triggers");
    if (tier === undefined) {
      throw new Error(`Skill '${name}' is missing a tier in skills.config.ts`);
    }
    if (triggers === undefined || asList(triggers).length === 0) {
      throw new Error(`Skill '${name}' is missing triggers in skills.config.ts`);
    }

    skills.push({
      name,
      category,
      description: String(frontmatter.description ?? "").replace(/\s+/g, " ").trim(),
      tier: Number(tier ?? 2),
      triggers: asList(triggers),
      conflicts_with: asList(getField(frontmatter, "conflicts_with")),
      depends_on: asList(getField(frontmatter, "depends_on")),
      path: relPath,
    });
  }
  return skills.sort((a, b) =>
    a.category === b.category
      ? a.name.localeCompare(b.name)
      : a.category.localeCompare(b.category),
  );
}

function categoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    agents: "Framework management and agent configuration",
    behavior: "Evidence, code quality, and critical thinking",
    coaching: "User guidance and focus support",
    "code-review": "PR/MR review and remediation",
    engineering: "Cross-cutting engineering practices (frontend, nodejs/typescript, bootstrap-ts-repo, prototype, security)",
    experimentation: "Sandboxed experimentation",
    foundation: "Always-on behavioral primitives and activation tiers",
    integrations: "External platform connectors",
    methodology: "Development methodology",
    orchestration: "Agent coordination, isolation, context management, and skill discovery",
    research: "Codebase analysis and documentation tools",
    safety: "Destructive operation protection and recovery",
    "self-learning": "Retrospective learning and skill-improvement feedback",
    tools: "Agent development utilities",
    troubleshooting: "Scoped descent, debugging, and performance investigation",
    verification: "Runtime proof and evidence-backed claims",
    workflow: "Development workflow",
  };
  const description = Object.prototype.hasOwnProperty.call(descriptions, category)
    ? descriptions[category]
    : undefined;
  if (description === undefined) {
    throw new Error(`Unknown skill category: ${category}`);
  }
  return description;
}

function validateSkillReferences(skills: Skill[]): Set<string> {
  const known = new Set<string>();
  for (const skill of skills) known.add(skill.name);

  for (const skill of skills) {
    for (const target of skill.conflicts_with) {
      if (!known.has(target)) {
        throw new Error(`${skill.path}: conflicts_with references unknown skill '${target}'`);
      }
    }
    for (const target of skill.depends_on) {
      if (!known.has(target)) {
        throw new Error(`${skill.path}: depends_on references unknown skill '${target}'`);
      }
    }
  }

  return known;
}

function assertKnownReferences(output: string, known: Set<string>): void {
  const pattern = /\$skill\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(output)) !== null) {
    const target = match[1];
    if (!known.has(target)) {
      throw new Error(`Generated matrix references unknown skill '${target}'`);
    }
  }
}

function generateMatrix(skills: Skill[]): string {
  const byCategory = new Map<string, Skill[]>();
  for (const skill of skills) {
    if (!byCategory.has(skill.category)) byCategory.set(skill.category, []);
    byCategory.get(skill.category)!.push(skill);
  }

  const categories = [...byCategory.keys()].sort();

  let output = `# Skill Coverage Matrix\n\n`;
  output += `Auto-generated from skill frontmatter. Run \`npx tsx scripts/generate-coverage-matrix.ts\` to regenerate.\n\n`;

  output += `## By category\n\n`;
  output += `| Category | Description | Skills |\n`;
  output += `| --- | --- | --- |\n`;
  for (const category of categories) {
    const list = byCategory.get(category)!.map((s) => `\`${s.name}\``).join(", ");
    output += `| \`${category}\` | ${categoryDescription(category)} | ${list} |\n`;
  }

  output += `\n## Skill catalog\n\n`;
  output += `| Skill | Category | Tier | Triggers | Conflicts with | Depends on |\n`;
  output += `| --- | --- | --- | --- | --- | --- |\n`;
  for (const skill of skills) {
    const conflicts = skill.conflicts_with.map((c) => `\`$skill{${c}}\``).join(", ") || "—";
    const depends = skill.depends_on.map((c) => `\`$skill{${c}}\``).join(", ") || "—";
    output += `| \`${skill.name}\` | \`${skill.category}\` | ${skill.tier} | ${skill.triggers.join(", ")} | ${conflicts} | ${depends} |\n`;
  }

  const withConflicts = skills.filter((s) => s.conflicts_with.length > 0);
  if (withConflicts.length > 0) {
    output += `\n## Disambiguation (use this, not that)\n\n`;
    for (const skill of withConflicts) {
      const others = skill.conflicts_with.map((c) => `\`$skill{${c}}\``).join(", ");
      output += `- **\`$skill{${skill.name}}\`** — ${skill.description} Use this, not ${others}.\n`;
    }
  }

  output += `\n## Decision tree\n\n`;
  output += `- **Need to understand before editing?** → \`$skill{investigate-first}\`\n`;
  output += `- **Have a runtime failure or regression?** → \`$skill{debugging}\`\n`;
  output += `- **Know the exact fix and want one narrow change?** → \`$skill{one-shot-patch}\`\n`;
  output += `- **Before patching, want to avoid overengineering or symptom-only fixes?** → \`$skill{minimal-root-cause}\`\n`;
  output += `- **Need adversarial review of a non-trivial decision?** → \`$skill{doubt-driven-development}\`\n`;
  output += `- **Implementing a multi-file or large change?** → \`$skill{incremental-implementation}\`\n`;
  output += `- **Need repeated inspect-edit-validate cycles with explicit stop conditions?** → \`$skill{loop-programming}\`\n`;
  output += `- **Reviewing a PR on GitHub?** → \`$skill{github-pr-review}\`\n`;
  output += `- **End-to-end fixing of PR/MR threads on a repo?** → \`$skill{act}\`\n`;
  output += `- **Multi-axis quality review before merge?** → \`$skill{code-review-and-quality}\`\n`;

  return output;
}

const { values } = parseArgs({
  options: {
    check: { type: "boolean", default: false },
    output: { type: "string", default: OUTPUT },
  },
  allowPositionals: false,
});

const skills = loadSkills();
const knownNames = validateSkillReferences(skills);
const generated = generateMatrix(skills);
assertKnownReferences(generated, knownNames);

if (values.check) {
  if (!existsSync(values.output)) {
    console.error(`error: ${values.output} does not exist; run without --check to generate`);
    process.exit(1);
  }
  const existing = readFileSync(values.output, "utf-8");
  if (existing.replace(/\r\n/g, "\n") !== generated.replace(/\r\n/g, "\n")) {
    console.error(`error: ${values.output} is out of sync with skill frontmatter`);
    console.error("Run 'npx tsx scripts/generate-coverage-matrix.ts' to regenerate.");
    process.exit(1);
  }
  console.log(`✅ ${values.output} is in sync.`);
  process.exit(0);
}

writeFileSync(values.output, generated, "utf-8");
console.log(`wrote ${skills.length} skills to ${values.output}`);
