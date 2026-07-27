#!/usr/bin/env -S node --experimental-strip-types --no-warnings
/**
 * Generate a skills index README for the skills-sync distribution mirror.
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/skills-sync-readme.ts \
 *     --source skills-sync/.agents/skills \
 *     --skills-root skills \
 *     --out skills-sync/README.md \
 *     [--vault-prefix obsidian/]
 *
 * The source is the flat skill tree (e.g. .agents/skills). The skills root is the
 * original skills/ category tree used to resolve skill categories. External
 * skills installed into the flat tree but absent from the skills root are shown
 * under the `(external)` category.
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  resolve,
} from "node:path";
import process from "node:process";

interface Options {
  source: string;
  out: string;
  skillsRoot: string | null;
  vaultPrefix: string;
}

interface SkillMeta {
  name: string;
  category: string;
  description: string;
  dependsOn: string[];
  usedBy: number;
}

const KEBAB_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const INDEX_DESC_MAX = 80;

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let source: string | null = null;
  let out: string | null = null;
  let skillsRoot: string | null = null;
  let vaultPrefix = "obsidian/";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
    } else if (arg === "--source") {
      source = args[++i];
      if (!source) throw new Error("--source requires a value");
    } else if (arg === "--out") {
      out = args[++i];
      if (!out) throw new Error("--out requires a value");
    } else if (arg === "--skills-root") {
      skillsRoot = args[++i];
      if (!skillsRoot) throw new Error("--skills-root requires a value");
    } else if (arg === "--vault-prefix") {
      vaultPrefix = args[++i];
      if (!vaultPrefix) throw new Error("--vault-prefix requires a value");
    } else if (arg.startsWith("--source=")) {
      source = arg.slice("--source=".length);
    } else if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length);
    } else if (arg.startsWith("--skills-root=")) {
      skillsRoot = arg.slice("--skills-root=".length);
    } else if (arg.startsWith("--vault-prefix=")) {
      vaultPrefix = arg.slice("--vault-prefix=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!source || !out) {
    console.error("Error: --source and --out are required.");
    printHelp();
  }

  return {
    source: resolve(source),
    out: resolve(out),
    skillsRoot: skillsRoot ? resolve(skillsRoot) : null,
    vaultPrefix,
  };
}

function printHelp(): never {
  console.log(`
Usage: node --experimental-strip-types --no-warnings scripts/skills-sync-readme.ts \
  --source <DIR> --out <PATH> [--skills-root <DIR>] [--vault-prefix <PATH>]

Generate a skills index README for the skills-sync distribution mirror.

Options:
  --source=DIR        Source flat skill tree (e.g. skills-sync/.agents/skills)
  --skills-root=DIR   Original skills/ category tree to resolve categories
  --out=PATH          Output README path (e.g. skills-sync/README.md)
  --vault-prefix=DIR  Prefix for Obsidian note links (default: obsidian/)
`);
  process.exit(0);
}

function toPosix(p: string): string {
  return p.replaceAll("\\", "/");
}

function isKebab(name: string): boolean {
  return KEBAB_PATTERN.test(name);
}

function parseFrontmatter(text: string): {
  attrs: Record<string, string>;
  body: string;
} {
  const lines = text.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== "---") {
    return { attrs: {}, body: text };
  }
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---"
  );
  if (end === -1) return { attrs: {}, body: text };

  const raw = lines.slice(1, end);
  const attrs: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  for (const line of raw) {
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyMatch) {
      if (currentKey) attrs[currentKey] = currentValue.join(" ").trim();
      currentKey = keyMatch[1];
      currentValue = [keyMatch[2].trim()];
    } else if (currentKey && /^\s+/.test(line)) {
      currentValue.push(line.trim());
    }
  }
  if (currentKey) attrs[currentKey] = currentValue.join(" ").trim();

  const body = lines.slice(end + 1).join("\n");
  return { attrs, body };
}

function cleanDescription(raw: string): string {
  if (!raw) return "";
  let desc = raw.replace(/^(>[>-]?|\|[-]?)\s*/, "").trim();
  desc = desc.replace(/^["']|["']$/g, "");
  // Render skill refs as plain names so the index stays readable on github.com.
  desc = desc.replace(/\$skill\{([a-z0-9]+(?:-[a-z0-9]+)*)\}/g, "$1");
  desc = desc.replace(/\$([a-z][a-z0-9]+(?:-[a-z0-9]+)*)\b/g, "$1");
  return desc;
}

function extractSkillRefs(text: string, known: Set<string>): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(
    /\$skill\{([a-z0-9]+(?:-[a-z0-9]+)*)\}/g
  )) {
    found.add(match[1]);
  }
  for (const match of text.matchAll(/\$([a-z][a-z0-9]+(?:-[a-z0-9]+)*)\b/g)) {
    const name = match[1];
    if (name === "skill" || !known.has(name)) continue;
    found.add(name);
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

function resolveSymlinkText(source: string, name: string): string | null {
  const linkFile = join(source, name);
  try {
    const st = lstatSync(linkFile);
    if (!st.isFile() || st.size > 1024) return null;
    const text =
      readFileSync(linkFile, "utf-8").trim().split(/\r?\n/)[0]?.trim() || "";
    if (!text) return null;
    if (isAbsolute(text)) return text;
    return resolve(source, text);
  } catch {
    return null;
  }
}

function findSkillRoot(source: string, name: string): string | null {
  const directDir = join(source, name);
  if (existsSync(directDir)) {
    try {
      if (statSync(directDir).isDirectory()) return directDir;
    } catch {
      // fall through
    }
  }
  const fromLink = resolveSymlinkText(source, name);
  if (fromLink && existsSync(fromLink)) {
    try {
      if (statSync(fromLink).isDirectory()) return fromLink;
    } catch {
      // fall through
    }
  }
  return null;
}

function buildCategoryMap(skillsRoot: string): Map<string, string> {
  const map = new Map<string, string>();

  function walk(dir: string, category: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const skillMd = join(full, "SKILL.md");
        if (existsSync(skillMd) && isKebab(entry.name)) {
          map.set(entry.name, category || "(root)");
        } else {
          const nextCategory = category
            ? `${category}/${entry.name}`
            : entry.name;
          walk(full, nextCategory);
        }
      }
    }
  }

  walk(skillsRoot, "");
  return map;
}

function findSkillCategory(
  source: string,
  name: string,
  skillsRoot: string | null,
  categoryMap: Map<string, string> | null
): string {
  if (categoryMap && categoryMap.has(name)) {
    return categoryMap.get(name) as string;
  }

  if (skillsRoot) {
    const resolvedCategoryMap = buildCategoryMap(skillsRoot);
    if (resolvedCategoryMap.has(name)) {
      return resolvedCategoryMap.get(name) as string;
    }
  }

  const resolved = resolveSymlinkText(source, name);
  if (resolved) {
    const parts = toPosix(resolved).split("/");
    const lastSkills = parts.lastIndexOf("skills");
    if (lastSkills !== -1 && lastSkills < parts.length - 1) {
      const categoryParts = parts.slice(lastSkills + 1, parts.length - 1);
      return categoryParts.join("/") || "(root)";
    }
  }

  return "(external)";
}

function listSkills(
  source: string,
  skillsRoot: string | null
): { skills: Map<string, string>; categories: Map<string, string> } {
  const skills = new Map<string, string>();
  const categories = new Map<string, string>();
  if (!existsSync(source)) {
    throw new Error(`Source directory does not exist: ${source}`);
  }

  const categoryMap = skillsRoot ? buildCategoryMap(skillsRoot) : null;

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const name = entry.name;
    if (!isKebab(name)) continue;
    const skillRoot = findSkillRoot(source, name);
    if (!skillRoot) continue;
    const skillMd = join(skillRoot, "SKILL.md");
    if (!existsSync(skillMd)) continue;

    const { attrs } = parseFrontmatter(readFileSync(skillMd, "utf-8"));
    const skillName = (attrs.name || name).replace(/^["']|["']$/g, "");
    if (skillName !== name) {
      throw new Error(
        `Skill folder/name mismatch: folder is ${name} but SKILL.md says ${skillName}`
      );
    }

    skills.set(name, skillMd);
    categories.set(
      name,
      findSkillCategory(source, name, skillsRoot, categoryMap)
    );
  }

  return { skills, categories };
}

function buildMeta(
  skills: Map<string, string>,
  categories: Map<string, string>
): Map<string, SkillMeta> {
  const known = new Set<string>(skills.keys());
  const metas = new Map<string, SkillMeta>();

  for (const [name, skillMd] of skills) {
    const text = readFileSync(skillMd, "utf-8");
    const { attrs, body } = parseFrontmatter(text);
    const description = cleanDescription(attrs.description || "");
    const dependsOn = extractSkillRefs(body, known).filter((d) => d !== name);
    metas.set(name, {
      name,
      category: categories.get(name) || "(unknown)",
      description,
      dependsOn,
      usedBy: 0,
    });
  }

  // compute usedBy
  for (const meta of metas.values()) {
    for (const dep of meta.dependsOn) {
      const target = metas.get(dep);
      if (target) target.usedBy++;
    }
  }

  return metas;
}

function truncateDescription(desc: string, max = INDEX_DESC_MAX): string {
  if (!desc) return "";
  if (desc.length <= max) return desc;
  return desc.slice(0, max).trim() + "…";
}

function escapeMdTableCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function writeReadme(
  opts: Options,
  metas: Map<string, SkillMeta>
): void {
  const skills = [...metas.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const totalEdges = skills.reduce((sum, s) => sum + s.dependsOn.length, 0);

  const byCategory = new Map<string, SkillMeta[]>();
  for (const skill of skills) {
    const list = byCategory.get(skill.category) || [];
    list.push(skill);
    byCategory.set(skill.category, list);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  const categoryNames = [...byCategory.keys()].sort((a, b) =>
    a.localeCompare(b)
  );

  const lines: string[] = [
    "# theplenkov-ai/skills-sync",
    "",
    "> **Generated mirror.** This repository is automatically maintained by the",
    "> [`Sync skills to skills-sync`](https://github.com/theplenkov-ai/skills/blob/main/.github/workflows/skills-sync.yml)",
    "> workflow in [`theplenkov-ai/skills`](https://github.com/theplenkov-ai/skills).",
    "> Do not edit files here by hand — update the source `SKILL.md` files in `skills`",
    "> and let CI propagate the changes.",
    "",
    "## Contents",
    "",
    "- `.agents/skills/` — flat skill tree for dotagents / Cursor / Codex runtimes.",
    "- `obsidian/` — Obsidian vault with `[[wikilink]]`-resolved skill notes and Graph view.",
    "- `graphs/` — per-skill Mermaid dependency graphs. GitHub renders them with pan/zoom.",
    "- `.claude-plugin/` — Claude Code plugin manifest, marketplace catalog and `skills-index.json`.",
    "- `.codex-plugin/` — ChatGPT/Codex plugin manifest.",
    "- `.agents/plugins/marketplace.json` — ChatGPT/Codex Plugins Directory catalog.",
    "- `README.md` — this auto-generated skills index.",
    "",
    "## Stats",
    "",
    `- **Skills:** ${skills.length}`,
    `- **Edges:** ${totalEdges}`,
    "",
    "## Dependency graphs",
    "",
    "Focused Mermaid graphs for every skill are in [`graphs/`](graphs/).",
    "The gallery index is [`graphs/index.md`](graphs/index.md).",
    "",
    "## Skills by category",
    "",
  ];

  for (const category of categoryNames) {
    lines.push(`### ${category}`, "");
    lines.push("| Skill | Description | Dependencies | Dependents | Note |");
    lines.push("| --- | --- | ---: | ---: | --- |");
    for (const skill of byCategory.get(category) || []) {
      const noteLink = `${opts.vaultPrefix}${skill.name}/${skill.name}.md`;
      const desc = escapeMdTableCell(truncateDescription(skill.description));
      lines.push(
        `| [${skill.name}](${noteLink}) | ${desc} | ${skill.dependsOn.length} | ${skill.usedBy} | [open](${noteLink}) |`
      );
    }
    lines.push("");
  }

  const outDir = dirname(opts.out);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(opts.out, lines.join("\n"), "utf-8");
  console.log(`Wrote README: ${opts.out}`);
}

function main(): number {
  try {
    const opts = parseArgs();
    const { skills, categories } = listSkills(opts.source, opts.skillsRoot);
    const metas = buildMeta(skills, categories);
    writeReadme(opts, metas);
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`error: ${message}`);
    return 1;
  }
}

process.exit(main());
