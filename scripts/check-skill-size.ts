import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKILLS_DIR = join(ROOT, "skills");
const WARNING_THRESHOLD = 250;

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

for (const skillFile of walkSkillFiles(SKILLS_DIR)) {
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
