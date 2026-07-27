import fs from 'node:fs';
import path from 'node:path';
import type { Skill, PluginManifest, SkillLink } from './types.js';

interface ParsedSkill {
  frontmatter: Record<string, string>;
  body: string;
}

function parseFrontmatter(content: string): ParsedSkill {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && value) frontmatter[key] = value;
  }
  return { frontmatter, body: match[2] };
}

export function discoverSkills(skillsRoot: string): Map<string, Skill> {
  const byName = new Map<string, Skill>();

  function walk(dir: string, rel: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const skillFile = path.join(dir, 'SKILL.md');
    const isSkill = fs.existsSync(skillFile);

    if (isSkill) {
      const text = fs.readFileSync(skillFile, 'utf8');
      const { frontmatter, body } = parseFrontmatter(text);
      const name = frontmatter.name ?? path.basename(dir);
      const description = frontmatter.description ?? '';
      const source = frontmatter.source ?? '';
      const category = rel.split('/').filter((s) => s !== 'dependencies');
      const skill: Skill = {
        name,
        root: rel,
        dir,
        category,
        description,
        source,
        body,
        frontmatter,
        links: [],
      };
      if (byName.has(name)) {
        const existing = byName.get(name)!;
        throw new Error(
          `Duplicate skill name '${name}' found at '${rel}' and '${existing.root}'. Skill names must be unique across the entire skills tree.`
        );
      }
      byName.set(name, skill);
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const childDir = path.join(dir, entry.name);
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      // Inside a skill only recurse into the dependencies directory.
      // Category directories (no SKILL.md) are walked entirely.
      if (isSkill && entry.name !== 'dependencies') continue;
      walk(childDir, childRel);
    }
  }

  walk(skillsRoot, '');

  // Second pass: resolve links now that all skills are known.
  for (const skill of byName.values()) {
    skill.links = resolveLinksInBody(skill.body, skill.dir, skillsRoot, byName);
  }

  return byName;
}

function resolveLinksInBody(
  body: string,
  sourceDir: string,
  skillsRoot: string,
  skillsByName: Map<string, Skill>
): SkillLink[] {
  const links: SkillLink[] = [];
  const seen = new Set<string>();

  // Markdown links to SKILL.md files.
  const mdLinkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdLinkRegex.exec(body)) !== null) {
    const [raw, text, url] = match;
    if (raw.startsWith('!')) continue; // images
    if (url.startsWith('http') || url.startsWith('#')) continue;
    const resolved = path.resolve(sourceDir, url.split('?')[0].split('#')[0]);
    if (!resolved.toLowerCase().endsWith('.md')) continue;
    const skillDir = path.dirname(resolved);
    const skillFile = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const relToSkills = path.relative(path.resolve(skillsRoot), skillDir).replace(/\\/g, '/');
    // Find skill by directory
    for (const skill of skillsByName.values()) {
      if (skill.root === relToSkills && !seen.has(raw)) {
        seen.add(raw);
        links.push({ text, targetName: skill.name, raw, type: 'file' });
        break;
      }
    }
  }

  // Legacy $skill{name} references.
  const skillRefRegex = /\$skill\{([a-z][a-z0-9-]*)\}/g;
  while ((match = skillRefRegex.exec(body)) !== null) {
    const [raw, targetName] = match;
    if (!skillsByName.has(targetName)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    links.push({ text: targetName, targetName, raw, type: 'macro' });
  }

  return links;
}

export function readPluginManifest(pluginDir: string): PluginManifest | null {
  const pluginJson = path.join(pluginDir, 'plugin.json');
  if (!fs.existsSync(pluginJson)) return null;
  const content = fs.readFileSync(pluginJson, 'utf8');
  return JSON.parse(content) as PluginManifest;
}

export function resolveClosure(
  include: string[],
  skillsByName: Map<string, Skill>,
  followMacroLinks = true
): Skill[] {
  const result: Skill[] = [];
  const visited = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    const skill = skillsByName.get(name);
    if (!skill) return;
    visited.add(name);
    for (const link of skill.links) {
      if (link.type === 'macro' && !followMacroLinks) continue;
      visit(link.targetName);
    }
    result.push(skill);
  }

  for (const name of include) {
    visit(name);
  }

  return result;
}

export function inferProjectName(projectRoot: string, workspaceRoot: string): string {
  return path.relative(path.resolve(workspaceRoot), path.resolve(projectRoot)).replace(/\\/g, '/');
}
