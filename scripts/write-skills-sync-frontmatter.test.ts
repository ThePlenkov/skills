import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as parseYaml } from 'yaml';
import { rewriteSkill, walkSkillDirs } from './write-skills-sync-frontmatter.js';

describe('write-skills-sync-frontmatter', () => {
  let sourceDir: string;

  beforeEach(() => {
    sourceDir = mkdtempSync(join(tmpdir(), 'skills-sync-test-'));
  });

  afterEach(() => {
    rmSync(sourceDir, { recursive: true, force: true });
  });

  it('rewrites a SKILL.md with central metadata from skills.config.ts', () => {
    const skillDir = join(sourceDir, 'act');
    mkdirSync(skillDir, { recursive: true });
    const skillFile = join(skillDir, 'SKILL.md');
    writeFileSync(
      skillFile,
      '---\nname: act\ndescription: Fix PR review threads and CI issues.\n---\n# Act\n',
      'utf8'
    );

    rewriteSkill(skillFile);

    const text = readFileSync(skillFile, 'utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    expect(match).not.toBeNull();
    const parsed = parseYaml(match![1]) as Record<string, unknown>;
    expect(parsed.name).toBe('act');
    expect(parsed.description).toBe('Fix PR review threads and CI issues.');
    expect(parsed.tier).toBe(2);
    expect(parsed.triggers).toEqual(['user', 'model']);
    expect(parsed.source).toBe('theplenkov-ai/skills');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('theplenkov-ai/skills');
    expect(Array.isArray((parsed.metadata as Record<string, unknown>)['allowed-tools'])).toBe(true);
  });

  it('preserves source-owned metadata while applying central overrides', () => {
    const skillDir = join(sourceDir, 'external-skill');
    mkdirSync(skillDir, { recursive: true });
    const skillFile = join(skillDir, 'SKILL.md');
    writeFileSync(
      skillFile,
      '---\nname: external-skill\ndescription: An external skill.\nmetadata:\n  source: owner/external\n  version: "1.0.0"\n---\n# External\n',
      'utf8'
    );

    rewriteSkill(skillFile);

    const text = readFileSync(skillFile, 'utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const parsed = parseYaml(match![1]) as Record<string, unknown>;
    // No central config entry, so source stays as declared and version is preserved.
    expect(parsed.source).toBe('owner/external');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('owner/external');
    expect((parsed.metadata as Record<string, unknown>).version).toBe('1.0.0');
  });

  it('walks skill directories and skips non-directory entries', () => {
    writeFileSync(join(sourceDir, 'not-a-dir.md'), '', 'utf8');
    const skillDir = join(sourceDir, 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    const skillFile = join(skillDir, 'SKILL.md');
    writeFileSync(skillFile, '---\nname: my-skill\ndescription: Test.\n---\n', 'utf8');

    const files = walkSkillDirs(sourceDir);
    expect(files).toEqual([skillFile]);
  });
});
