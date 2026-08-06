#!/usr/bin/env -S node --experimental-strip-types --no-warnings
/**
 * Build an Obsidian vault from a flat skill tree.
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/obsidian-vault.ts --source <DIR> --out <DIR> [--clean]
 *
 * Input (e.g. .agents/skills):
 *   <skill>/{SKILL.md, assets/, references/, ...}
 *
 * Output (Obsidian vault):
 *   <skill>/<skill>.md
 *   <skill>/assets/
 *   <skill>/references/
 *   .obsidian/graph.json
 *
 * Transforms $skill{name} and $name references into [[wikilinks]] so
 * Obsidian's graph view can draw skill-to-skill connections.
 */

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";

interface Options {
  source: string;
  out: string;
  clean: boolean;
}

const KEBAB_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let source: string | null = null;
  let out: string | null = null;
  let clean = false;

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
    } else if (arg === "--clean") {
      clean = true;
    } else if (arg.startsWith("--source=")) {
      source = arg.slice("--source=".length);
    } else if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!source || !out) {
    console.error("Error: --source and --out are required.");
    printHelp();
  }

  return { source: resolve(source), out: resolve(out), clean };
}

function printHelp(): never {
  console.log(`
Usage: node --experimental-strip-types --no-warnings scripts/obsidian-vault.ts --source <DIR> --out <DIR> [--clean]

Build an Obsidian vault from a flat skill tree (e.g. .agents/skills).

Options:
  --source=DIR  Source directory containing skill folders (e.g. .agents/skills)
  --out=DIR     Output directory (the Obsidian vault root)
  --clean       Remove and recreate the output directory before building
`);
  process.exit(0);
}

function isKebab(name: string): boolean {
  return KEBAB_PATTERN.test(name);
}

function resolveSymlinkText(source: string, name: string): string | null {
  const linkFile = join(source, name);
  try {
    const st = lstatSync(linkFile);
    if (!st.isFile() || st.size > 1024) return null;
    const text = readFileSync(linkFile, "utf-8").trim().split(/\r?\n/)[0]?.trim() || "";
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

function listSkills(source: string): Map<string, string> {
  const skills = new Map<string, string>();
  if (!existsSync(source)) {
    throw new Error(`Source directory does not exist: ${source}`);
  }
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const name = entry.name;
    if (!isKebab(name)) continue;
    const skillRoot = findSkillRoot(source, name);
    if (!skillRoot) continue;
    const skillMd = join(skillRoot, "SKILL.md");
    if (!existsSync(skillMd)) continue;
    const skillName = readSkillName(skillMd, name);
    if (skillName !== name) {
      throw new Error(
        `Skill folder/name mismatch: folder is ${name} but SKILL.md says ${skillName}`
      );
    }
    skills.set(name, skillMd);
  }
  return skills;
}

function readSkillName(skillMd: string, fallback: string): string {
  const text = readFileSync(skillMd, "utf-8");
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---/);
  if (!m) return fallback;
  const nameLine = m[0].split(/\r?\n/).find((line) => /^name:\s*/.test(line));
  if (!nameLine) return fallback;
  const name = nameLine.replace(/^name:\s*/, "").trim().replace(/^["']|["']$/g, "");
  return name || fallback;
}

function isUrlExternal(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) || url.startsWith("#") || url.startsWith("mailto:");
}

function transformOutsideCode(body: string, fn: (text: string) => string): string {
  const triple = body.split(/(```[\s\S]*?```)/g);
  for (let i = 0; i < triple.length; i += 2) {
    const inline = triple[i].split(/(`[^`]*`)/g);
    for (let j = 0; j < inline.length; j += 2) {
      inline[j] = fn(inline[j]);
    }
    triple[i] = inline.join("");
  }
  return triple.join("");
}

function replaceSkillRefs(text: string, known: Set<string>): string {
  // $skill{name}
  text = text.replace(/\$skill\{([a-z0-9]+(?:-[a-z0-9]+)*)\}/g, "[[$1]]");
  // $name for known skills; skip $skill itself and $PATH-style variables
  text = text.replace(/\$([a-z][a-z0-9]+(?:-[a-z0-9]+)*)\b/g, (m, name) => {
    if (name === "skill" || !known.has(name)) return m;
    return `[[${name}]]`;
  });
  return text;
}

function rewriteSkillMdLinks(
  text: string,
  known: Set<string>,
  currentPath: string,
  vaultRoot: string
): string {
  return text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (match, linkText, url: string) => {
    if (isUrlExternal(url)) return match;

    const parts = url.split(/[\\/]/).filter(Boolean);
    const fileName = parts[parts.length - 1];
    if (!fileName || fileName.toLowerCase() !== "skill.md") {
      return match;
    }

    // Resolve the target directory relative to the current file.
    const resolvedDir = resolve(dirname(currentPath), ...parts.slice(0, -1));
    const rel = relative(vaultRoot, resolvedDir);
    const candidateName = rel.split(/[\\/]/).filter(Boolean)[0];

    if (candidateName && known.has(candidateName)) {
      const display = linkText || candidateName;
      return `[[${candidateName}${display === candidateName ? "" : `|${display}`}]]`;
    }

    return match;
  });
}

function addSkillTag(text: string): string {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2 || lines[0].trim() !== "---") return text;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) return text;

  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (/^tags:\s*/.test(line)) {
      const values = line
        .replace(/^tags:\s*/, "")
        .replace(/[\[\]"']/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!values.includes("skill")) values.push("skill");
      lines[i] = `tags: [${values.join(", ")}]`;
      return lines.join("\n");
    }
  }

  lines.splice(end, 0, "tags: [skill]");
  return lines.join("\n");
}

function transformMarkdown(
  text: string,
  known: Set<string>,
  isSkillRoot: boolean,
  currentPath: string,
  vaultRoot: string
): string {
  if (isSkillRoot) {
    text = addSkillTag(text);
  }

  text = transformOutsideCode(text, (plain) => {
    plain = replaceSkillRefs(plain, known);
    plain = rewriteSkillMdLinks(plain, known, currentPath, vaultRoot);
    return plain;
  });

  return text;
}

function copyTree(src: string, dst: string, options: { onFile?: (srcPath: string, dstPath: string) => void } = {}): void {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const dstPath = join(dst, entry.name);
    if (entry.isDirectory()) {
      copyTree(srcPath, dstPath, options);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      cpSync(srcPath, dstPath, { force: true });
      options.onFile?.(srcPath, dstPath);
    }
  }
}

function buildVault(opts: Options): number {
  if (!existsSync(opts.source)) {
    console.error(`Source directory not found: ${opts.source}`);
    return 1;
  }

  const skills = listSkills(opts.source);
  const known = new Set<string>(skills.keys());

  if (opts.clean && existsSync(opts.out)) {
    rmSync(opts.out, { recursive: true, force: true });
  }
  mkdirSync(opts.out, { recursive: true });

  for (const [name, skillMd] of skills) {
    const srcDir = dirname(skillMd);
    const outDir = join(opts.out, name);
    mkdirSync(outDir, { recursive: true });

    // Copy non-markdown and subdirectories first, then process markdown files.
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const srcPath = join(srcDir, entry.name);
      let dstPath = join(outDir, entry.name);
      const isSkillMd = entry.name === "SKILL.md";

      if (isSkillMd) {
        dstPath = join(outDir, `${name}.md`);
        const text = readFileSync(srcPath, "utf-8");
        const transformed = transformMarkdown(text, known, true, dstPath, opts.out);
        writeFileSync(dstPath, transformed, "utf-8");
      } else if (entry.isDirectory()) {
        copyTree(srcPath, dstPath, {
          onFile: (srcFile, dstFile) => {
            if (extname(dstFile).toLowerCase() === ".md") {
              const text = readFileSync(dstFile, "utf-8");
              const transformed = transformMarkdown(text, known, false, dstFile, opts.out);
              writeFileSync(dstFile, transformed, "utf-8");
            }
          },
        });
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        cpSync(srcPath, dstPath, { force: true });
      }
    }
  }

  // Obsidian graph settings: show only skill root notes.
  const obsidianDir = join(opts.out, ".obsidian");
  mkdirSync(obsidianDir, { recursive: true });
  const graphConfig = {
    collapseFilter: true,
    search: "tag:skill",
    showTags: false,
    showAttachments: false,
    hideUnresolved: false,
    showOrphans: true,
    collapseColorGroups: true,
    colorGroups: [],
    collapseDisplay: true,
    showArrow: true,
    textFadeMultiplier: 0,
    nodeSizeMultiplier: 1,
    lineSizeMultiplier: 1,
    collapseForces: true,
    centerStrength: 0.5,
    repelStrength: 10,
    linkStrength: 1,
    linkDistance: 250,
    scale: 1,
    close: false,
  };
  writeFileSync(
    join(obsidianDir, "graph.json"),
    JSON.stringify(graphConfig, null, 2) + "\n",
    "utf-8"
  );

  console.log(
    `Obsidian vault built: ${skills.size} skills -> ${opts.out}`
  );
  return 0;
}

function main(): number {
  try {
    const opts = parseArgs();
    return buildVault(opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`error: ${message}`);
    return 1;
  }
}

process.exit(main());
