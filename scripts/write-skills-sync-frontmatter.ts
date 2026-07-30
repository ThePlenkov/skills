#!/usr/bin/env -S node --experimental-strip-types --no-warnings
/**
 * Rewrite SKILL.md frontmatter in the skills-sync mirror.
 *
 * Usage:
 *   node --experimental-strip-types --no-warnings scripts/write-skills-sync-frontmatter.ts --source <DIR>
 *
 * Reads each SKILL.md under <DIR>/<skill>/, replaces its frontmatter with
 * the canonical skills-sync metadata (source, tier, triggers, tags, etc.),
 * and writes the file back.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { defaultSkillMetadata, skillMetadata } from '../skills.config.ts';

interface Options {
  source: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let source: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--source') {
      source = args[++i];
      if (!source) throw new Error('--source requires a value');
    } else if (arg.startsWith('--source=')) {
      source = arg.slice('--source='.length);
    }
  }
  if (!source) throw new Error('--source is required');
  return { source: resolve(source) };
}

function getMeta(frontmatter: Record<string, unknown>): Record<string, unknown> {
  if (
    frontmatter.metadata &&
    typeof frontmatter.metadata === 'object' &&
    !Array.isArray(frontmatter.metadata)
  ) {
    return frontmatter.metadata as Record<string, unknown>;
  }
  return {};
}

export function walkSkillDirs(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = join(dir, entry.name);
    const skillFile = join(skillDir, 'SKILL.md');
    try {
      if (statSync(skillFile).isFile()) result.push(skillFile);
    } catch {
      // ignore
    }
  }
  return result;
}

export function rewriteSkill(skillFile: string): void {
  const content = readFileSync(skillFile, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/);
  if (!match) {
    throw new Error(`No valid leading frontmatter block in ${skillFile}`);
  }
  const parsed = parseYaml(match[1]);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Invalid YAML frontmatter in ${skillFile}`);
  }
  const frontmatter = parsed as Record<string, unknown>;
  if (!frontmatter.name || !frontmatter.description) {
    throw new Error(`Missing name or description in frontmatter of ${skillFile}`);
  }
  const body = match[2] ?? '';
  const name = String(frontmatter.name || '');
  const meta = getMeta(frontmatter);
  const config = name ? skillMetadata[name] : undefined;
  const configMeta = config?.frontmatter?.metadata ?? {};

  // Start with the source file's metadata, then let the central config override
  // or fill in canonical fields (source, tier, triggers, allowed-tools, etc.).
  const metadata: Record<string, unknown> = { ...meta, ...configMeta };

  // Source: prefer the skill's own source (e.g. external skills), then config, then default.
  const ownSource = meta.source ?? frontmatter.source;
  const configSource = configMeta.source;
  metadata.source =
    ownSource ??
    configSource ??
    String(defaultSkillMetadata.frontmatter?.metadata?.source ?? 'theplenkov-ai/skills');

  // Preserve all non-centralized frontmatter keys while replacing the metadata object.
  const { metadata: _oldMetadata, ...rest } = frontmatter;
  const output: Record<string, unknown> = {
    ...rest,
    name: String(frontmatter.name ?? ''),
    description: String(frontmatter.description ?? ''),
    metadata,
  };

  // Hoist canonical activation metadata to top-level so indexers that read
  // frontmatter.tier / frontmatter.triggers directly still see the right values,
  // overwriting any stale top-level copies that remain from an older layout.
  for (const key of ['source', 'tier', 'triggers']) {
    if (metadata[key] !== undefined) {
      output[key] = metadata[key];
    }
  }

  const yaml = stringifyYaml(output, { lineWidth: 0 });
  writeFileSync(skillFile, `---\n${yaml}---\n${body}`, 'utf8');
  console.log(`rewrote ${skillFile}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { source } = parseArgs();
  for (const skillFile of walkSkillDirs(source)) {
    rewriteSkill(skillFile);
  }
}
