import fs from 'node:fs';
import path from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { rewriteBody } from './common.js';
import type { CompilerOptions, Skill, SkillLink } from '../types.js';

const DEFAULT_CANONICAL_SOURCE = 'theplenkov-ai/skills';

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
  let v = value.trim();
  if (v === '') return null;

  // Accept `https://github.com/owner/repo.git` and `git@github.com:owner/repo.git`.
  const httpsMatch = /^https?:\/\/([^/]+)\/(.+)$/.exec(v);
  const gitMatch = /^git@[^:]+:(.+)$/.exec(v);
  if (httpsMatch) {
    v = httpsMatch[2];
  } else if (gitMatch) {
    v = gitMatch[1];
  } else if (v.includes('://') || v.startsWith('git@')) {
    // Looks like a URL/SCP form but did not match the expected patterns.
    return null;
  }

  // Strip a trailing `.git` (with optional trailing slash) to normalise.
  v = v.replace(/\.git\/?$/i, '');

  const parts = v.split('/').filter((p) => p !== '');
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!owner || !repo) return null;
  if (/\s/.test(owner) || /\s/.test(repo)) return null;
  return `${owner}/${repo}`;
}

export function normalizeFrontmatter(input: Record<string, unknown>, publicSource?: string): string {
  const safeInput =
    input && typeof input === 'object' && !Array.isArray(input)
      ? input
      : ({} as Record<string, unknown>);

  const output: Record<string, unknown> = { ...safeInput };

  const sourceMeta =
    safeInput.metadata && typeof safeInput.metadata === 'object' && !Array.isArray(safeInput.metadata)
      ? (safeInput.metadata as Record<string, unknown>)
      : {};

  // Preserve all metadata from the source, then backfill legacy top-level keys
  // so both pre- and post-migration layouts produce the same published output.
  const metadata: Record<string, unknown> = { ...sourceMeta };
  for (const key of Object.keys(safeInput)) {
    if (key === 'metadata' || key === 'name' || key === 'description') continue;
    if (metadata[key] === undefined) metadata[key] = safeInput[key];
  }

  const rawSource = String(metadata.source ?? safeInput.source ?? '');
  const canonicalSource = normalizeRepoShorthand(rawSource) ?? 'theplenkov-ai/skills';

  let targetSource = canonicalSource;
  if (publicSource !== undefined) {
    const normalizedPublic = normalizeRepoShorthand(publicSource);
    if (!normalizedPublic) {
      throw new Error(
        `publicSource must be a non-empty owner/repo shorthand, got: ${JSON.stringify(publicSource)}`
      );
    }
    // Only override the public mirror for skills owned by this repo.
    // Forks and external skills keep their declared canonical source.
    if (canonicalSource === DEFAULT_CANONICAL_SOURCE) {
      targetSource = normalizedPublic;
    }
  }

  metadata.source = targetSource;
  output.metadata = metadata;
  output.source = targetSource;
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

    const header = `---\n${normalizeFrontmatter(skill.frontmatter, options.publicSource)}---\n`;
    const body = rewriteBody(skill.body, skill.links, linkFormatter, skill);
    fs.writeFileSync(path.join(destDir, 'SKILL.md'), header + body, 'utf8');
  }

  for (const skill of skills) {
    if (skill.name === projectName) continue;
    emitSkill(skill, path.join(depsDir, skill.name), false);
  }
  emitSkill(primary, options.outDir, true);
}
