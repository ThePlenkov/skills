/**
 * Generate per-skill Mermaid dependency subgraphs plus a global adjacency map.
 *
 * For each skill we emit a focused graph showing:
 *   - the skill itself (center)
 *   - its direct dependencies (skills it references via `$skill{name}`)
 *   - its direct reverse dependencies (skills that reference it)
 * Neighbors are grouped under labeled subgraphs.
 *
 * Output (regenerable; safe to delete and recreate):
 *   - <graph-dir>/<skill>.md  Mermaid block wrapped in markdown (GitHub-native
 *                              pan/zoom when viewed on github.com)
 *   - <graph-dir>/index.md    Gallery linking all skills by category
 *   - <json>                  Adjacency map for downstream tooling
 *
 * Usage:
 *   npx tsx scripts/generate-skills-graph.ts [--graph-dir DIR] [--json PATH] [--root DIR] [--neighbors N]
 */

import { parse as parseYaml } from "yaml";
import { parseArgs } from "node:util";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const KEBAB_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const SCRIPT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPT_REPO_ROOT_REAL = fs.realpathSync(path.resolve(SCRIPT_DIR, ".."));

const DEFAULT_NEIGHBOR_CAP = 15;
const DESCRIPTION_MAX = 200;
const INDEX_DESC_MAX = 80;

interface SkillInfo {
  name: string;
  category: string;
  relPath: string;
  description: string;
  body: string;
  dependsOn: string[];
  usedBy: string[];
}

interface GraphData {
  version: 1;
  generated_at: string;
  count: number;
  edges: Array<{ from: string; to: string }>;
  skills: SkillInfo[];
  unknown_refs: Array<{ from: string; to: string }>;
}

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function safeRealpath(target: string): string | null {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

function validateRepoRoot(input: string): string {
  const resolved = path.resolve(input);
  if (!isInside(SCRIPT_REPO_ROOT_REAL, resolved) && resolved !== SCRIPT_REPO_ROOT_REAL) {
    throw new Error(`repository root ${resolved} must be inside ${SCRIPT_REPO_ROOT_REAL}`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`repository root does not exist: ${resolved}`);
  }
  const real = safeRealpath(resolved);
  if (!real || !realpathIsDirectory(real)) {
    throw new Error(`repository root is not a directory: ${resolved}`);
  }
  if (!isInside(SCRIPT_REPO_ROOT_REAL, real) && real !== SCRIPT_REPO_ROOT_REAL) {
    throw new Error(`repository root realpath ${real} escapes ${SCRIPT_REPO_ROOT_REAL}`);
  }
  return resolved;
}

function realpathIsDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function validateOutputPath(input: string, repoRoot: string): string {
  const resolved = path.isAbsolute(input)
    ? path.resolve(input)
    : path.resolve(repoRoot, input);
  const realRoot = safeRealpath(repoRoot) ?? path.resolve(repoRoot);

  function assertInsideRepo(target: string): void {
    const realTarget = safeRealpath(target) ?? target;
    if (!isInside(realRoot, realTarget) && realTarget !== realRoot) {
      throw new Error(`output path ${resolved} is outside the repository root ${realRoot}`);
    }
  }

  if (fs.existsSync(resolved)) {
    assertInsideRepo(resolved);
  } else {
    let current = path.dirname(resolved);
    while (!fs.existsSync(current) && current !== path.dirname(current)) {
      current = path.dirname(current);
    }
    assertInsideRepo(current);
  }
  return resolved;
}

function parseFrontmatter(text: string): { frontmatter: Record<string, unknown>; body: string } {
  const lines = text.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== "---") return { frontmatter: {}, body: text };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) return { frontmatter: {}, body: text };
  const raw = parseYaml(lines.slice(1, end).join("\n"));
  if (raw == null) return { frontmatter: {}, body: lines.slice(end + 1).join("\n") };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("frontmatter must be a YAML mapping");
  }
  return { frontmatter: raw as Record<string, unknown>, body: lines.slice(end + 1).join("\n") };
}

function extractDeps(body: string, knownNames: Set<string>): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(/\$skill\{([a-z0-9]+(?:-[a-z0-9]+)*)\}/g)) {
    found.add(match[1]);
  }
  for (const match of body.matchAll(/\$([a-z][a-z0-9]+(?:-[a-z0-9]+)*)\b/g)) {
    const name = match[1];
    if (name === "skill") continue;
    if (knownNames.has(name)) found.add(name);
  }
  return [...found].sort((a, b) => a.localeCompare(b));
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

function isNestedUnderExistingSkill(skillsRoot: string, rel: string): boolean {
  const parts = rel.split("/");
  for (let depth = 1; depth < parts.length - 1; depth++) {
    const ancestor = path.join(skillsRoot, ...parts.slice(0, depth), "SKILL.md");
    if (fs.existsSync(ancestor)) return true;
  }
  return false;
}

function readSkillMeta(
  skillMd: string,
  skillsRoot: string
): { name: string; category: string; relPath: string; description: string; body: string } {
  const rel = path.relative(skillsRoot, skillMd).replaceAll("\\", "/");
  const parts = rel.split("/");
  const text = fs.readFileSync(skillMd, "utf-8");
  const { frontmatter, body } = parseFrontmatter(text);

  const name =
    typeof frontmatter.name === "string"
      ? frontmatter.name
      : path.basename(path.dirname(skillMd));
  if (!KEBAB_PATTERN.test(name)) {
    throw new Error(`${rel}: skill name '${name}' does not match ${KEBAB_PATTERN}`);
  }

  const rawDescription =
    typeof frontmatter.description === "string"
      ? frontmatter.description.replace(/\s+/g, " ").trim()
      : "";

  return {
    name,
    category: parts.slice(0, -2).join("/"),
    relPath: rel,
    description: rawDescription.slice(0, DESCRIPTION_MAX).trimEnd(),
    body,
  };
}

function collectSkills(skillsRoot: string): SkillInfo[] {
  const seenNames = new Map<string, string>();
  const skills: SkillInfo[] = [];

  for (const skillMd of [...walkSkillFiles(skillsRoot)].sort((a, b) => a.localeCompare(b))) {
    const rel = path.relative(skillsRoot, skillMd).replaceAll("\\", "/");
    if (rel.split("/").length < 3) continue;
    if (isNestedUnderExistingSkill(skillsRoot, rel)) continue;
    const meta = readSkillMeta(skillMd, skillsRoot);
    if (seenNames.has(meta.name)) {
      throw new Error(
        `duplicate skill name '${meta.name}': ${seenNames.get(meta.name)} and ${rel}`
      );
    }
    seenNames.set(meta.name, rel);
    skills.push({ ...meta, dependsOn: [], usedBy: [] });
  }
  return skills;
}

function resolveDependencies(skills: SkillInfo[]): { unknownRefs: Array<{ from: string; to: string }> } {
  const known = new Set(skills.map((s) => s.name));
  const unknownRefs: Array<{ from: string; to: string }> = [];
  for (const skill of skills) {
    const all = extractDeps(skill.body, known).filter((d) => d !== skill.name);
    skill.dependsOn = all.filter((d) => known.has(d));
    for (const d of all) {
      if (!known.has(d)) unknownRefs.push({ from: skill.name, to: d });
    }
    skill.body = "";
  }
  const byName = new Map(skills.map((s) => [s.name, s] as const));
  for (const skill of skills) {
    for (const dep of skill.dependsOn) {
      const target = byName.get(dep);
      if (target && !target.usedBy.includes(skill.name)) target.usedBy.push(skill.name);
    }
  }
  for (const skill of skills) {
    skill.dependsOn.sort((a, b) => a.localeCompare(b));
    skill.usedBy.sort((a, b) => a.localeCompare(b));
  }
  return { unknownRefs };
}

function loadSkills(repoRoot: string): { skills: SkillInfo[]; unknownRefs: Array<{ from: string; to: string }> } {
  const skillsRoot = path.join(repoRoot, "skills");
  if (!fs.existsSync(skillsRoot)) {
    throw new Error(`skills directory not found: ${skillsRoot}`);
  }
  const skills = collectSkills(skillsRoot);
  const { unknownRefs } = resolveDependencies(skills);
  return { skills, unknownRefs };
}

function buildGraph(skills: SkillInfo[], unknownRefs: Array<{ from: string; to: string }>): GraphData {
  const edges: Array<{ from: string; to: string }> = [];
  for (const skill of skills) {
    for (const dep of skill.dependsOn) {
      edges.push({ from: skill.name, to: dep });
    }
  }
  edges.sort((a, b) =>
    a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)
  );

  return {
    version: 1,
    generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    count: skills.length,
    edges,
    skills,
    unknown_refs: unknownRefs,
  };
}

interface FocusGraph {
  center: SkillInfo;
  deps: SkillInfo[];
  usedBy: SkillInfo[];
  truncatedDeps: boolean;
  truncatedUsedBy: boolean;
}

function buildFocus(center: SkillInfo, all: SkillInfo[], cap: number): FocusGraph {
  const byName = new Map(all.map((s) => [s.name, s]));
  const deps = center.dependsOn.map((n) => byName.get(n)).filter((s): s is SkillInfo => Boolean(s));
  const usedBy = center.usedBy.map((n) => byName.get(n)).filter((s): s is SkillInfo => Boolean(s));
  return {
    center,
    deps: deps.slice(0, cap),
    usedBy: usedBy.slice(0, cap),
    truncatedDeps: deps.length > cap,
    truncatedUsedBy: usedBy.length > cap,
  };
}

function mdEscape(value: string): string {
  return value.replaceAll('"', "&quot;");
}

function nodeLabel(name: string, category: string): string {
  return `${mdEscape(name)}<br/><i>${mdEscape(category)}</i>`;
}

function renderFocusMermaid(focus: FocusGraph): string {
  const { center, deps, usedBy } = focus;
  const id = (n: string) => n.replaceAll("-", "_");
  const depNames = new Set(deps.map((d) => d.name));
  const usedByOnly = usedBy.filter((u) => !depNames.has(u.name));
  const mutual = usedBy.filter((u) => depNames.has(u.name));

  const usedByBlock =
    usedByOnly.length === 0
      ? []
      : [
          '  subgraph sg_used_by["used by"]',
          "    direction TB",
          ...usedByOnly.map((u) => `    ${id(u.name)}["${nodeLabel(u.name, u.category)}"]`),
          "  end",
          ...usedByOnly.map((u) => `  ${id(u.name)} --> ${id(center.name)}`),
          "",
        ];

  const depsToRender = deps;

  const depsBlock =
    depsToRender.length === 0
      ? []
      : [
          '  subgraph sg_depends_on["depends on"]',
          "    direction TB",
          ...depsToRender.map((d) => `    ${id(d.name)}["${nodeLabel(d.name, d.category)}"]`),
          "  end",
          ...depsToRender.map((d) => `  ${id(center.name)} --> ${id(d.name)}`),
        ];

  const mutualEdges = mutual.map((u) => {
    const safeName = mdEscape(`↕ mutual with ${u.name}`);
    return `  ${id(u.name)} -. "${safeName}" .-> ${id(center.name)}`;
  });

  return [
    "```mermaid",
    "graph LR",
    `  ${id(center.name)}["${nodeLabel(center.name, center.category)}"]`,
    "  classDef center fill:#1d4ed8,stroke:#fbbf24,stroke-width:3px,color:#fff",
    `  class ${id(center.name)} center`,
    "",
    ...usedByBlock,
    ...depsBlock,
    ...mutualEdges,
    "```",
  ].join("\n");
}

function generatedFileBanner(): string[] {
  return [
    "<!-- AUTO-GENERATED by scripts/generate-skills-graph.ts — do not edit by hand. -->",
    "<!-- Regenerate with: npm run graph:update -->",
    "",
    "> ⚠️ **AUTO-GENERATED — do not edit this file by hand.**",
    "> Edits will be overwritten. To change the graph, edit the source `SKILL.md` files and run `npm run graph:update`.",
    "> Source: `scripts/generate-skills-graph.ts` · Regenerate: `npm run graph:update`",
  ];
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderFocusMarkdown(focus: FocusGraph): string {
  const { center } = focus;
  const truncated: string[] = [];
  if (focus.truncatedDeps) {
    truncated.push(`${center.dependsOn.length} deps (showing ${focus.deps.length})`);
  }
  if (focus.truncatedUsedBy) {
    truncated.push(`${center.usedBy.length} dependents (showing ${focus.usedBy.length})`);
  }
  const truncationLine = truncated.length > 0 ? `_graph truncated: ${truncated.join(", ")}_\n` : "";

  const sections = [
    ...generatedFileBanner(),
    "",
    `# ${center.name}`,
    "",
    `> **Category:** \`${center.category}\` · **Path:** \`skills/${center.relPath}\``,
    ...(center.description ? ["", center.description] : []),
    "",
    `## Stats`,
    "",
    `${center.dependsOn.length} dependencies · ${center.usedBy.length} dependents`,
    ...(truncationLine ? [truncationLine.trimEnd()] : []),
    "",
    "## Graph",
    "",
    "Rendered with [Mermaid](https://mermaid.js.org/). On github.com click any node to zoom; drag to pan. If the diagram fails to load, regenerate locally with `npm run graph:update`.",
    "",
    renderFocusMermaid(focus),
    "",
  ];
  return sections.join("\n");
}

function renderIndexMarkdown(graph: GraphData): string {
  const byCategory = new Map<string, SkillInfo[]>();
  for (const skill of graph.skills) {
    const list = byCategory.get(skill.category) ?? [];
    list.push(skill);
    byCategory.set(skill.category, list);
  }
  const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b));

  const categoryBlocks = categories.map((category) => {
    const members = byCategory
      .get(category)!
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    const header = [`## ${category}`, "", "| Skill | Dependencies | Dependents | Graph |", "| --- | ---: | ---: | --- |"];
    const rows = members.map((skill) => {
      const desc = skill.description ? ` — ${escapeTableCell(skill.description.slice(0, INDEX_DESC_MAX).trimEnd())}` : "";
      return `| \`${skill.name}\`${desc} | ${skill.dependsOn.length} | ${skill.usedBy.length} | [graph](${skill.name}.md) |`;
    });
    return [...header, ...rows, ""].join("\n");
  });

  const unknownSection = graph.unknown_refs.length > 0
    ? [
        "## ⚠️ Unknown skill references",
        "",
        `Found ${graph.unknown_refs.length} reference(s) to skill names that don't exist in \`skills/\`. These are recorded in \`unknown_refs\` but excluded from edges and per-skill graphs (since \`$skill{...}\` is always trusted). Fix the typo or add the missing skill.`,
        "",
        ...graph.unknown_refs.map((u) => `- \`${u.from}\` references \`${u.to}\``),
        "",
      ]
    : [];

  return [
    ...generatedFileBanner(),
    "",
    "# Skills dependency graphs",
    "",
    "Per-skill focus graphs showing direct dependencies and dependents.",
    `Contains ${graph.count} skills and ${graph.edges.length} edges.`,
    "",
    "Each row links to a focused graph for that skill, rendered with Mermaid. On github.com the linked `.md` files render with native pan/zoom (click any node).",
    "",
    "Regenerate locally with `npm run graph:update`.",
    "",
    ...unknownSection,
    ...categoryBlocks,
  ].join("\n");
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      "graph-dir": { type: "string" },
      json: { type: "string" },
      root: { type: "string", default: "." },
      neighbors: { type: "string", default: String(DEFAULT_NEIGHBOR_CAP) },
      "allow-unknown-refs": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.error(
      "Usage: npx tsx scripts/generate-skills-graph.ts [--graph-dir DIR] [--json PATH] [--neighbors N] [--allow-unknown-refs]"
    );
    return 0;
  }

  if (!values["graph-dir"] && !values.json) {
    console.error("error: at least one of --graph-dir or --json is required");
    return 1;
  }

  const cap = Number(values.neighbors);
  if (!Number.isInteger(cap) || cap < 1) {
    console.error(`error: --neighbors must be a positive integer, got '${values.neighbors}'`);
    return 1;
  }

  try {
    const repoRoot = validateRepoRoot(values.root);
    const { skills, unknownRefs } = loadSkills(repoRoot);
    const graph = buildGraph(skills, unknownRefs);

    if (values.json) {
      const jsonPath = validateOutputPath(values.json, repoRoot);
      fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
      fs.writeFileSync(jsonPath, JSON.stringify(graph, null, 2) + "\n", "utf-8");
      console.log(`wrote graph (${graph.count} skills, ${graph.edges.length} edges) to ${jsonPath}`);
    }

    if (values["graph-dir"]) {
      const dirPath = validateOutputPath(values["graph-dir"]!, repoRoot);
      fs.mkdirSync(dirPath, { recursive: true });

      const expectedFiles = new Set(skills.map((s) => `${s.name}.md`).concat(["index.md"]));

      const skillOutputs = skills.map((skill) => {
        const focus = buildFocus(skill, skills, cap);
        return [path.join(dirPath, `${skill.name}.md`), renderFocusMarkdown(focus)] as const;
      });
      for (const [file, content] of skillOutputs) {
        fs.writeFileSync(file, content, "utf-8");
      }

      fs.writeFileSync(path.join(dirPath, "index.md"), renderIndexMarkdown(graph), "utf-8");

      const existing = new Set(
        fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"))
      );
      let removed = 0;
      for (const name of existing) {
        if (!expectedFiles.has(name)) {
          fs.unlinkSync(path.join(dirPath, name));
          removed++;
        }
      }
      if (removed > 0) {
        console.warn(`removed ${removed} stale .md file(s) from ${dirPath}`);
      }

      console.log(
        `wrote ${skills.length} per-skill graphs (md) + index.md to ${dirPath}`
      );
    }

    if (graph.unknown_refs.length > 0 && !values["allow-unknown-refs"]) {
      const list = graph.unknown_refs.map((u) => `  ${u.from} -> ${u.to}`).join("\n");
      console.error(
        `error: ${graph.unknown_refs.length} references to unknown skill names:\n${list}\n` +
          `Fix the typo or add the missing skill. Output was written for inspection; pass --allow-unknown-refs to suppress this error.`
      );
      return 2;
    }

    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`error: ${message}`);
    return 1;
  }
}

process.exit(await main());