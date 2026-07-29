import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { rewriteBody } from './common.js';
import type { CompilerOptions, Skill, SkillLink } from '../types.js';

function copySkillDirectory(src: string, dest: string): void {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'dependencies') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copySkillDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function normalizeRepoShorthand(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v === '') return null;
  if (/^https?:\/\//.test(v)) return null;
  if (v.toLowerCase().endsWith('.git')) return null;
  const parts = v.split('/');
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!owner || !repo) return null;
  if (/\s/.test(owner) || /\s/.test(repo)) return null;
  return v;
}

export function normalizeFrontmatter(input: Record<string, unknown>, publicSource?: string): string {
  const safeInput =
    input && typeof input === 'object' && !Array.isArray(input)
      ? input
      : ({} as Record<string, unknown>);

  const output: Record<string, unknown> = { ...safeInput };

  const rawSource =
    typeof safeInput.source === 'string' ? safeInput.source : undefined;
  const canonicalSource = normalizeRepoShorthand(rawSource) ?? 'theplenkov-ai/skills';
  output.source = canonicalSource;

  const metadata: Record<string, unknown> = {};
  if (
    safeInput.metadata &&
    typeof safeInput.metadata === 'object' &&
    !Array.isArray(safeInput.metadata)
  ) {
    Object.assign(metadata, safeInput.metadata as Record<string, unknown>);
  }
  for (const key of ['tags', 'author', 'version']) {
    if (safeInput[key] !== undefined) metadata[key] = safeInput[key];
  }
  metadata.source = canonicalSource;

  if (publicSource !== undefined) {
    const normalizedPublic = normalizeRepoShorthand(publicSource);
    if (!normalizedPublic) {
      throw new Error(
        `publicSource must be a non-empty owner/repo shorthand, got: ${JSON.stringify(publicSource)}`
      );
    }
    metadata.publicSource = normalizedPublic;
  }

  output.metadata = metadata;
  return stringifyYaml(output, { lineWidth: 0 });
}

export function buildSkillsSh(options: CompilerOptions, skills: Skill[], projectName: string): void {
  const byName = new Map(skills.map((s) => [s.name, s]));
  const primary = byName.get(projectName);
  if (!primary) {
    throw new Error(`Primary skill '${projectName}' not found for skills-sh build`);
  }

  fs.mkdirSync(options.outDir, { recursive: true });
  const depsDir = path.join(options.outDir, 'dependencies');

  function emitSkill(skill: Skill, destDir: string, isPrimary: boolean): void {
    copySkillDirectory(skill.dir, destDir);
    const linkFormatter = (link: SkillLink, source: Skill) => {
      if (link.type === 'macro') return link.raw;
      const target = byName.get(link.targetName);
      if (!target) return link.raw;
      if (isPrimary) {
        return `[${link.text}](dependencies/${target.name}/SKILL.md)`;
      }
      if (target.name === projectName) {
        return `[${link.text}](../SKILL.md)`;
      }
      return `[${link.text}](../${target.name}/SKILL.md)`;
    };

    const original = fs.readFileSync(path.join(skill.dir, 'SKILL.md'), 'utf8');
    const match = original.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    const parsed = match ? parseYaml(match[1]) : {};
    const frontmatter: Record<string, unknown> =
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const header = `---\n${normalizeFrontmatter(frontmatter, options.publicSource)}---\n`;
    const body = rewriteBody(skill.body, skill.links, linkFormatter, skill);
    fs.writeFileSync(path.join(destDir, 'SKILL.md'), header + body, 'utf8');
  }

  for (const skill of skills) {
    if (skill.name === projectName) continue;
    emitSkill(skill, path.join(depsDir, skill.name), false);
  }
  emitSkill(primary, options.outDir, true);
}
