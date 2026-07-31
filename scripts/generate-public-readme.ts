#!/usr/bin/env node
/**
 * Generate an auto-updating README for a public skills.sh distribution mirror.
 *
 * Usage:
 *   npx tsx scripts/generate-public-readme.ts --out README.md
 *   npx tsx scripts/generate-public-readme.ts --out README.md --check
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import process from 'node:process';
import { discoverSkills } from '../tools/compiler/src/resolver.ts';
import publications from '../public-skills.config.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKILLS_DIR = path.join(ROOT, 'skills');

interface SkillStats {
  name: string;
  category: string;
  description: string;
  bytes: number;
  lines: number;
  stack: string;
  deps: number;
  target: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countLines(text: string): number {
  return text.split(/\r?\n/).length;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', default: 'README.md' },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.error('Usage: npx tsx scripts/generate-public-readme.ts [--out PATH] [--check]');
    return 0;
  }

  const skillsByName = discoverSkills(SKILLS_DIR);
  const outPath = path.resolve(String(values.out));

  const stats: SkillStats[] = [];
  for (const pub of publications) {
    const skill = skillsByName.get(pub.skill);
    if (!skill) {
      console.error(`warning: public skill '${pub.skill}' not found in skills tree`);
      continue;
    }
    const text = fs.readFileSync(path.join(skill.dir, 'SKILL.md'), 'utf8');
    const bytes = Buffer.byteLength(text, 'utf8');
    const lines = countLines(text);
    const fileLinks = skill.links.filter((l) => l.type === 'file').map((l) => l.targetName);
    const macroLinks = skill.links.filter((l) => l.type === 'macro').map((l) => l.targetName);
    const deps = new Set([...fileLinks, ...macroLinks]);
    stats.push({
      name: skill.name,
      category: skill.category.join('/'),
      description: skill.description,
      bytes,
      lines,
      stack: 'skills-sh',
      deps: deps.size,
      target: pub.format,
    });
  }

  stats.sort((a, b) => a.name.localeCompare(b.name));

  const totalBytes = stats.reduce((sum, s) => sum + s.bytes, 0);
  const totalLines = stats.reduce((sum, s) => sum + s.lines, 0);
  const totalDeps = stats.reduce((sum, s) => sum + s.deps, 0);

  const lines: string[] = [
    '# ThePlenkov/skills',
    '',
    'Public [skills.sh](https://skills.sh) distribution mirror for selected agent skills.',
    '',
    '## Install',
    '',
    '```bash',
    'npx skills add ThePlenkov/skills --skill <name>',
    '```',
    '',
    '## Badges',
    '',
    `![skills.sh](https://img.shields.io/badge/distributed%20via-skills.sh-3178c6)`,
    `![public skills](https://img.shields.io/badge/public%20skills-${stats.length}-brightgreen)`,
    `![total size](https://img.shields.io/badge/total%20size-${formatBytes(totalBytes).replace(/\s/g, '%20')}-blue)`,
    '',
    '## Stats',
    '',
    `- **Public skills:** ${stats.length}`,
    `- **Total SKILL.md size:** ${formatBytes(totalBytes)}`,
    `- **Total SKILL.md lines:** ${totalLines.toLocaleString('en-US')}`,
    `- **Total skill edges:** ${totalDeps}`,
    '',
    '## Skills',
    '',
    '| Skill | Category | Description | Size | Lines | Stack | Deps |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const s of stats) {
    const desc = s.description.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    const shortDesc = desc.length > 60 ? desc.slice(0, 60).trim() + '…' : desc;
    lines.push(
      `| [${s.name}](skills/${s.name}/SKILL.md) | ${s.category} | ${shortDesc} | ${formatBytes(s.bytes)} | ${s.lines.toLocaleString('en-US')} | ${s.stack} | ${s.deps} |`,
    );
  }

  lines.push(
    '',
    '---',
    '',
    'This README is auto-generated. Do not edit it by hand.',
  );

  const generated = lines.join('\n') + '\n';

  if (values.check) {
    if (!fs.existsSync(outPath)) {
      console.error(`error: ${outPath} does not exist; run without --check to generate`);
      return 1;
    }
    const existing = fs.readFileSync(outPath, 'utf8');
    if (existing.replace(/\r\n/g, '\n') !== generated.replace(/\r\n/g, '\n')) {
      console.error(`error: ${outPath} is out of sync with public-skills.config.ts`);
      return 1;
    }
    console.log(`✅ ${outPath} is in sync.`);
    return 0;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, generated, 'utf8');
  console.log(`wrote ${stats.length} public skills to ${outPath}`);
  return 0;
}

process.exit(await main());
