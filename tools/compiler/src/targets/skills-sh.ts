import fs from 'node:fs';
import path from 'node:path';
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
    const headerMatch = original.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
    const header = headerMatch ? headerMatch[0] : '';
    const body = rewriteBody(skill.body, skill.links, linkFormatter, skill);
    fs.writeFileSync(path.join(destDir, 'SKILL.md'), header + body, 'utf8');
  }

  for (const skill of skills) {
    if (skill.name === projectName) continue;
    emitSkill(skill, path.join(depsDir, skill.name), false);
  }
  emitSkill(primary, options.outDir, true);
}
