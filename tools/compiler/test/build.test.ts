import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.resolve(__dirname, '..', '..', '..', 'samples');
const skillsRoot = path.join(fixturesRoot, 'skills');
const pluginsRoot = path.join(fixturesRoot, 'plugins');

describe('build', () => {
  it('builds a skill Claude plugin bundle with resolved links', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-compiler-test-'));
    build({
      workspaceRoot: fixturesRoot,
      skillsRoot,
      pluginsRoot,
      projectRoot: path.join(skillsRoot, 'sample-two-axis-review'),
      target: 'claude',
      outDir,
    });

    expect(fs.existsSync(path.join(outDir, '.claude-plugin', 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'skills', 'sample-two-axis-review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'skills', 'sample-github-pr-review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'skills', 'sample-github', 'SKILL.md'))).toBe(true);

    const body = fs.readFileSync(path.join(outDir, 'skills', 'sample-two-axis-review', 'SKILL.md'), 'utf8');
    expect(body).toContain('$skill{sample-github-pr-review}');
    expect(body).toContain('$skill{sample-github}');
    expect(body).not.toContain('['); // markdown links replaced

    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('builds a plugin Claude bundle with included skills', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-compiler-plugin-test-'));
    build({
      workspaceRoot: fixturesRoot,
      skillsRoot,
      pluginsRoot,
      projectRoot: path.join(pluginsRoot, 'sample-review-pack'),
      target: 'claude',
      outDir,
    });

    const pluginJson = JSON.parse(fs.readFileSync(path.join(outDir, '.claude-plugin', 'plugin.json'), 'utf8'));
    expect(pluginJson.name).toBe('sample-review-pack');
    expect(fs.existsSync(path.join(outDir, 'skills', 'sample-two-axis-review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'skills', 'sample-github-pr-review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'skills', 'sample-github', 'SKILL.md'))).toBe(true);

    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('builds a skill with external dependencies only', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-compiler-external-test-'));
    build({
      workspaceRoot: fixturesRoot,
      skillsRoot,
      pluginsRoot,
      projectRoot: path.join(skillsRoot, 'sample-two-axis-review'),
      target: 'claude',
      outDir,
      dependencies: 'external',
    });

    expect(fs.existsSync(path.join(outDir, '.claude-plugin', 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'skills', 'sample-two-axis-review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'skills', 'sample-github-pr-review', 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'skills', 'sample-github', 'SKILL.md'))).toBe(false);

    const pluginJson = JSON.parse(fs.readFileSync(path.join(outDir, '.claude-plugin', 'plugin.json'), 'utf8'));
    expect(pluginJson.dependencies).toEqual(['sample-github', 'sample-github-pr-review']);

    const body = fs.readFileSync(path.join(outDir, 'skills', 'sample-two-axis-review', 'SKILL.md'), 'utf8');
    expect(body).toContain('$skill{sample-github-pr-review}');
    expect(body).toContain('$skill{sample-github}');

    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('merges skillMetadata into skills-sh frontmatter and hoists tier/triggers', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-compiler-metadata-test-'));
    const skillRoot = path.join(workspaceRoot, 'skills', 'my-skill');
    fs.mkdirSync(skillRoot, { recursive: true });
    fs.writeFileSync(
      path.join(skillRoot, 'SKILL.md'),
      '---\nname: my-skill\ndescription: A test skill.\n---\n# My Skill\n',
      'utf8'
    );
    fs.mkdirSync(path.join(workspaceRoot, 'plugins'), { recursive: true });

    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-compiler-metadata-out-'));
    build({
      workspaceRoot,
      skillsRoot: path.join(workspaceRoot, 'skills'),
      pluginsRoot: path.join(workspaceRoot, 'plugins'),
      projectRoot: skillRoot,
      target: 'skills-sh',
      outDir,
      skillMetadata: {
        'my-skill': {
          frontmatter: {
            metadata: {
              tier: 1,
              triggers: ['user'],
              source: 'owner/repo',
              'allowed-tools': ['read'],
            },
          },
        },
      },
    });

    const skillMd = fs.readFileSync(path.join(outDir, 'SKILL.md'), 'utf8');
    expect(skillMd).toContain('tier: 1');
    expect(skillMd).toContain('- user');
    expect(skillMd).toContain('source: owner/repo');
    expect(skillMd).toContain('allowed-tools:');

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });
});
