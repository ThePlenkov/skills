import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILLS_DIR = join(ROOT, "skills");
const WARNING_THRESHOLD = 250;

const { values } = parseArgs({
  options: {
    'skill': { type: 'string' },
  },
  allowPositionals: false,
});

interface OversizedSkill {
  path: string;
  name: string;
  lines: number;
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

function countLines(text: string): number {
  return text.length === 0 ? 0 : text.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

function extractName(frontmatter: string): string | null {
  const match = /^name:\s*(.+)$/m.exec(frontmatter);
  return match ? match[1].trim() : null;
}

const oversized: OversizedSkill[] = [];

// Collect skill files to check
const skillFiles: string[] = [];
if (values.skill) {
  const skillPath = resolve(ROOT, values.skill);
  const skillMd = join(skillPath, "SKILL.md");
  if (existsSync(skillMd)) {
    skillFiles.push(skillMd);
  } else {
    console.error(`::error file=${values.skill}::SKILL.md not found at ${values.skill}`);
    process.exit(1);
  }
} else {
  for (const f of walkSkillFiles(SKILLS_DIR)) {
    skillFiles.push(f);
  }
}

for (const skillFile of skillFiles) {
  const text = readFileSync(skillFile, "utf-8");
  const lines = countLines(text);
  const relPath = relative(ROOT, skillFile).replace(/\\/g, "/");

  if (lines > WARNING_THRESHOLD) {
    const name = extractName(text) ?? relPath;
    oversized.push({ path: relPath, name, lines });
  }
}

oversized.sort((a, b) => b.lines - a.lines);

if (oversized.length > 0) {
  for (const skill of oversized) {
    console.log(
      `::warning file=${skill.path},title=Oversized skill::${skill.name} has ${skill.lines} lines (>${WARNING_THRESHOLD}); consider moving examples/recipes to references/`,
    );
  }
  console.log(`\n${oversized.length} skill(s) exceed ${WARNING_THRESHOLD} lines.`);
} else {
  console.log(`All skills are within the ${WARNING_THRESHOLD}-line threshold.`);
}
