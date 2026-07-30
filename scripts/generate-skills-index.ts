/**
 * Generate a machine-readable index of all skills for lazy loading.
 *
 * The index lets agent runtimes route on lightweight metadata and load the full
 * SKILL.md body only when a skill is selected. The JSON Schema is derived from
 * the same TypeScript types, so the schema and the generated index always stay
 * in sync.
 *
 * Usage:
 *   npx tsx scripts/generate-skills-index.ts [--output PATH] [--root DIR] [--no-timestamp] [--schema PATH]
 *
 * Exits 0 on success; non-zero on validation errors.
 */

import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { parseArgs } from "node:util";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { isNestedSkill } from "./lib/nested-skill.js";

const ALLOWED_TRIGGERS = new Set(["user", "model", "always"] as const);
type Trigger = "user" | "model" | "always";

const KEBAB_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SKILL_PATH_PATTERN = /^skills\/.+\/SKILL\.md$/;
const COMMAND_PATTERN = /^\/[a-z0-9]+(-[a-z0-9]+)*$/;

const skillSchema = z
  .object({
    name: z.string().regex(KEBAB_PATTERN),
    path: z.string().regex(SKILL_PATH_PATTERN),
    category: z.string(),
    description: z.string().min(1),
    triggers: z.array(z.enum(["user", "model", "always"])),
    command: z.string().regex(COMMAND_PATTERN).nullable(),
    tags: z.array(z.string()),
    lines: z.number().int().min(0),
    always_on: z.boolean(),
    allowed_tools: z.array(z.string()),
    conflicts_with: z.array(z.string()),
    depends_on: z.array(z.string()),
  })
  .strict();

const indexSchema = z
  .object({
    version: z.literal(1),
    generated_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
      .optional(),
    count: z.number().int().min(0),
    skills: z.array(skillSchema),
  })
  .strict();

type Frontmatter = Record<string, unknown>;

const SCRIPT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const SCRIPT_REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function validateRepoRoot(input: string): string {
  const resolved = path.resolve(input);
  if (!isInside(SCRIPT_REPO_ROOT, resolved) && resolved !== SCRIPT_REPO_ROOT) {
    throw new Error(
      `repository root ${resolved} must be inside ${SCRIPT_REPO_ROOT}`
    );
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`repository root is not a directory: ${resolved}`);
  }
  return resolved;
}

function validateOutputPath(input: string, repoRoot: string): string {
  const resolved = path.isAbsolute(input)
    ? path.resolve(input)
    : path.resolve(repoRoot, input);
  if (!isInside(repoRoot, resolved)) {
    throw new Error(
      `output path ${resolved} is outside the repository root ${repoRoot}`
    );
  }
  return resolved;
}

function parseFrontmatter(text: string): {
  frontmatter: Frontmatter;
  body: string;
} {
  const lines = text.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== "---") {
    return { frontmatter: {}, body: text };
  }
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) {
    return { frontmatter: {}, body: text };
  }
  const block = lines.slice(1, end).join("\n");
  const body = lines.slice(end + 1).join("\n");
  const parsed = parseYaml(block);
  const frontmatter: Frontmatter =
    typeof parsed === "object" && parsed !== null ? (parsed as Frontmatter) : {};
  return { frontmatter, body };
}

function toStringScalar(value: unknown, context: string): string {
  if (value === null || value === undefined || typeof value === "object") {
    throw new Error(`${context} must be a scalar value`);
  }
  return String(value);
}

function getField(frontmatter: Record<string, unknown>, key: string): unknown {
  const metadata =
    frontmatter.metadata && typeof frontmatter.metadata === 'object' && !Array.isArray(frontmatter.metadata)
      ? (frontmatter.metadata as Record<string, unknown>)
      : undefined;
  return metadata?.[key] ?? frontmatter[key];
}

function asList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value
      .map((v, i) => toStringScalar(v, `list item ${i}`).trim())
      .filter(Boolean);
  }
  const text = toStringScalar(value, "value").trim();
  if (!text) return [];
  if (text.includes(",")) {
    return text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [text];
}

function lineCount(text: string): number {
  if (!text) return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

function categoryTagFromPath(relPath: string): string {
  const parts = relPath.split("/");
  return parts.length >= 3 ? parts[1] : "";
}

function* walkSkillFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkSkillFiles(full);
    } else if (entry.name === "SKILL.md") {
      yield full;
    }
  }
}

function loadCommandMap(repoRoot: string): Map<string, string> {
  const commandDir = path.join(repoRoot, ".agents", "commands");
  const map = new Map<string, string>();
  if (!fs.existsSync(commandDir)) return map;

  const files = fs
    .readdirSync(commandDir)
    .filter((name) => name.endsWith(".md") || name.endsWith(".toml"))
    .map((name) => path.join(commandDir, name))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const text = fs.readFileSync(file, "utf-8");
    const { frontmatter, body } = parseFrontmatter(text);
    const stem = path.basename(file, path.extname(file));

    const skillName = frontmatter.skill;
    if (typeof skillName === "string" && skillName && !map.has(skillName)) {
      map.set(skillName, stem);
      continue;
    }

    const wraps = /wraps the `([^`]+)` skill workflow/.exec(body);
    if (wraps?.[1] && !map.has(wraps[1])) {
      map.set(wraps[1], stem);
      continue;
    }

    const refMatch = /\.agents\/skills\/([a-z0-9-]+)\/SKILL\.md/.exec(body);
    if (refMatch?.[1] && !map.has(refMatch[1])) {
      map.set(refMatch[1], stem);
    }
  }

  return map;
}

function detectCommand(
  skillDir: string,
  commandMap: Map<string, string>,
  skillName: string
): string | null {
  const commandName = commandMap.get(skillName) ?? commandMap.get(path.basename(skillDir));
  if (commandName) return `/${commandName}`;

  const candidates = [
    path.join(skillDir, "commands", `${skillName}.md`),
    path.join(skillDir, "commands", `${skillName}.toml`),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return `/${skillName}`;
    }
  }
  return null;
}

function deriveTags(
  frontmatter: Frontmatter,
  category: string,
  name: string
): string[] {
  const tags = new Set<string>([category, name]);
  for (const trigger of asList(getField(frontmatter, "triggers"))) {
    tags.add(trigger);
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function buildEntry(
  skillMd: string,
  repoRoot: string,
  commandMap: Map<string, string>
): z.infer<typeof skillSchema> {
  const rel = path.relative(repoRoot, skillMd).replaceAll("\\", "/");
  const category = categoryTagFromPath(rel);
  const text = fs.readFileSync(skillMd, "utf-8");
  const { frontmatter } = parseFrontmatter(text);

  if (!frontmatter.name || !frontmatter.description) {
    const missing = ["name", "description"].filter((k) => !frontmatter[k]);
    throw new Error(
      `${rel}: missing required frontmatter field(s): ${missing.join(", ")}`
    );
  }

  const name = toStringScalar(frontmatter.name, "name");
  const triggers = asList(getField(frontmatter, "triggers")).filter((t): t is Trigger => {
    const ok = ALLOWED_TRIGGERS.has(t as Trigger);
    if (!ok) {
      throw new Error(
        `${rel}: invalid trigger '${t}' (allowed: ${[...ALLOWED_TRIGGERS].join(", ")})`
      );
    }
    return ok;
  });

  const allowedTools = asList(getField(frontmatter, "allowed-tools"));

  const raw = {
    name,
    path: rel,
    category,
    description: toStringScalar(frontmatter.description, "description").trim(),
    triggers,
    command: detectCommand(path.dirname(skillMd), commandMap, name),
    tags: deriveTags(frontmatter, category, name),
    lines: lineCount(text),
    always_on: triggers.includes("always"),
    allowed_tools: allowedTools,
    conflicts_with: asList(getField(frontmatter, "conflicts_with")),
    depends_on: asList(getField(frontmatter, "depends_on")),
  };

  return skillSchema.parse(raw);
}

function buildIndex(
  repoRoot: string,
  includeTimestamp: boolean
): z.infer<typeof indexSchema> {
  const skillsRoot = path.join(repoRoot, "skills");
  if (!fs.existsSync(skillsRoot)) {
    throw new Error(`skills directory not found: ${skillsRoot}`);
  }

  const commandMap = loadCommandMap(repoRoot);
  const seenNames = new Map<string, string>();
  const entries: z.infer<typeof skillSchema>[] = [];

  for (const skillMd of [...walkSkillFiles(skillsRoot)].sort((a, b) => a.localeCompare(b))) {
    const rel = path.relative(skillsRoot, skillMd);
    const parts = rel.split(path.sep);
    if (parts.length < 3) continue;
    if (isNestedSkill(skillMd, skillsRoot)) continue;

    const entry = buildEntry(skillMd, repoRoot, commandMap);
    if (seenNames.has(entry.name)) {
      throw new Error(
        `duplicate skill name '${entry.name}': ${seenNames.get(entry.name)} and ${entry.path}`
      );
    }
    seenNames.set(entry.name, entry.path);
    entries.push(entry);
  }

  for (const entry of entries) {
    for (const target of entry.conflicts_with) {
      if (target === entry.name) {
        throw new Error(`${entry.path}: skill cannot conflict with itself`);
      }
      if (!seenNames.has(target)) {
        throw new Error(`${entry.path}: conflicts_with references unknown skill '${target}'`);
      }
    }
    for (const target of entry.depends_on) {
      if (target === entry.name) {
        throw new Error(`${entry.path}: skill cannot depend on itself`);
      }
      if (!seenNames.has(target)) {
        throw new Error(`${entry.path}: depends_on references unknown skill '${target}'`);
      }
    }
  }

  entries.sort((a, b) =>
    (a.category === b.category
      ? a.name.localeCompare(b.name)
      : a.category.localeCompare(b.category))
  );

  const index: z.infer<typeof indexSchema> = {
    version: 1,
    count: entries.length,
    skills: entries,
  };
  if (includeTimestamp) {
    index.generated_at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  return indexSchema.parse(index);
}

function generateSchema(): Record<string, unknown> {
  const schema = zodToJsonSchema(indexSchema, {
    name: "SkillsIndex",
    $refStrategy: "none",
  });
  return {
    ...schema,
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Skills Index",
    description:
      "Machine-readable index of skills for lazy loading at scale. See issue #44.",
  };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      output: { type: "string" },
      root: { type: "string", default: "." },
      "no-timestamp": { type: "boolean", default: false },
      schema: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.error("Usage: npx tsx scripts/generate-skills-index.ts [--output PATH] [--root DIR] [--no-timestamp] [--schema PATH]");
    return 0;
  }

  if (!values.output && !values.schema) {
    console.error("error: at least one of --output or --schema is required");
    return 1;
  }

  try {
    const repoRoot = validateRepoRoot(values.root);

    if (values.output) {
      const outputPath = validateOutputPath(values.output, repoRoot);
      const index = buildIndex(repoRoot, !values["no-timestamp"]);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(
        outputPath,
        `${JSON.stringify(index, null, 2)}\n`,
        "utf-8"
      );
      console.log(`wrote ${index.count} skills to ${outputPath}`);
    }

    if (values.schema) {
      const schemaPath = validateOutputPath(values.schema, repoRoot);
      fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
      fs.writeFileSync(
        schemaPath,
        `${JSON.stringify(generateSchema(), null, 2)}\n`,
        "utf-8"
      );
      console.log(`wrote schema to ${schemaPath}`);
    }

    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`error: ${message}`);
    return 1;
  }
}

process.exit(await main());
