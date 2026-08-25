// validate-skill.ts — validate a single skill's SKILL.md frontmatter
// and agents/openai.yaml metadata. Designed for Nx per-skill target.
//
// Usage: tsx scripts/validate-skill.ts skills/code-review/act

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const { positionals } = parseArgs({
  options: {},
  allowPositionals: true,
});

if (positionals.length === 0) {
  console.error("Usage: tsx scripts/validate-skill.ts <skill-dir>");
  process.exit(1);
}

const skillDir = resolve(positionals[0]!);
const skillMdPath = join(skillDir, "SKILL.md");
const openaiYamlPath = join(skillDir, "agents", "openai.yaml");
const schemaPath = join(ROOT, ".github", "skill-schema.json");
const openaiSchemaPath = join(ROOT, ".github", "openai-metadata-schema.json");

let failed = false;

// --- Validate SKILL.md frontmatter ---

if (!existsSync(skillMdPath)) {
  console.error(`::error file=${skillMdPath}::SKILL.md not found`);
  process.exit(1);
}

const skillMd = readFileSync(skillMdPath, "utf8");
const frontmatterMatch = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!frontmatterMatch) {
  // Some skills may not have frontmatter — log a warning but don't fail
  console.log(`⚠ ${skillMdPath} — no YAML frontmatter found (skipping schema validation)`);
  process.exit(0);
}

const frontmatter = frontmatterMatch[1]!;

// Parse YAML frontmatter
let frontmatterJson: string;
try {
  const YAML = await import("yaml");
  frontmatterJson = JSON.stringify(YAML.parse(frontmatter));
} catch (e) {
  console.error(`::error file=${skillMdPath}::Failed to parse YAML frontmatter: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

// Validate against schema
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

// Use ajv if available, otherwise do basic checks
try {
  const AjvModule = await import("ajv");
  const Ajv = AjvModule.default as unknown as new (opts?: { allErrors?: boolean }) => {
    compile: (schema: unknown) => (data: unknown) => boolean;
    errors?: unknown[];
  };
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const data = JSON.parse(frontmatterJson);
  if (!validate(data)) {
    console.error(`::error file=${skillMdPath}::frontmatter validation failed`);
    for (const err of (ajv.errors ?? []) as Array<{ instancePath: string; message?: string }>) {
      console.error(`  ${err.instancePath}: ${err.message}`);
    }
    failed = true;
  } else {
    console.log(`✅ ${skillMdPath}`);
  }
} catch {
  // ajv not available — do basic field checks
  const data = JSON.parse(frontmatterJson) as Record<string, unknown>;
  if (typeof data.name !== "string" || !data.name) {
    console.error(`::error file=${skillMdPath}::missing or invalid 'name' in frontmatter`);
    failed = true;
  }
  if (typeof data.description !== "string" || !data.description) {
    console.error(`::error file=${skillMdPath}::missing or invalid 'description' in frontmatter`);
    failed = true;
  }
  if (!failed) console.log(`✅ ${skillMdPath} (basic checks)`);
}

// --- Validate agents/openai.yaml ---

if (!existsSync(openaiYamlPath)) {
  console.error(`::error file=${skillMdPath}::agents/openai.yaml not found`);
  failed = true;
} else {
  const openaiYaml = readFileSync(openaiYamlPath, "utf8");
  try {
    const YAML = await import("yaml");
    const openaiData = YAML.parse(openaiYaml);
    const openaiSchema = JSON.parse(readFileSync(openaiSchemaPath, "utf8"));
    try {
      const AjvModule = await import("ajv");
      const Ajv = AjvModule.default as unknown as new (opts?: { allErrors?: boolean }) => {
        compile: (schema: unknown) => (data: unknown) => boolean;
        errors?: unknown[];
      };
      const ajv = new Ajv({ allErrors: true });
      const validateOpenai = ajv.compile(openaiSchema);
      if (!validateOpenai(openaiData)) {
        console.error(`::error file=${openaiYamlPath}::openai.yaml validation failed`);
        for (const err of (ajv.errors ?? []) as Array<{ instancePath: string; message?: string }>) {
          console.error(`  ${err.instancePath}: ${err.message}`);
        }
        failed = true;
      } else {
        console.log(`✅ ${openaiYamlPath}`);
      }
    } catch {
      // ajv not available — basic checks
      if (!openaiData?.interface?.display_name) {
        console.error(`::error file=${openaiYamlPath}::missing interface.display_name`);
        failed = true;
      }
      if (!failed) console.log(`✅ ${openaiYamlPath} (basic checks)`);
    }
  } catch (e) {
    console.error(`::error file=${openaiYamlPath}::Failed to parse YAML: ${e instanceof Error ? e.message : String(e)}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
