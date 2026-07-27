import { describe, it, expect } from 'bun:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills, resolveClosure, readPluginManifest } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.resolve(__dirname, '..', '..', '..', 'samples');
const skillsRoot = path.join(fixturesRoot, 'skills');
const pluginsRoot = path.join(fixturesRoot, 'plugins');

describe('resolver', () => {
  it('discovers skills and parses markdown links', () => {
    const skills = discoverSkills(skillsRoot);
    expect(skills.size).toBe(3);

    const two = skills.get('sample-two-axis-review')!;
    expect(two.links.map((l) => l.targetName).sort()).toEqual(['sample-github', 'sample-github-pr-review']);

    const ghpr = skills.get('sample-github-pr-review')!;
    expect(ghpr.links.map((l) => l.targetName)).toEqual(['sample-github']);

    const gh = skills.get('sample-github')!;
    expect(gh.links).toEqual([]);
  });

  it('resolves closure in topological order', () => {
    const skills = discoverSkills(skillsRoot);
    const closure = resolveClosure(['sample-two-axis-review'], skills);
    expect(closure.map((s) => s.name)).toEqual(['sample-github', 'sample-github-pr-review', 'sample-two-axis-review']);
  });

  it('reads plugin manifests', () => {
    const two = readPluginManifest(path.join(pluginsRoot, 'sample-two-axis-review'));
    expect(two?.name).toBe('sample-two-axis-review');
    expect(two?.include).toEqual(['sample-two-axis-review']);

    const pack = readPluginManifest(path.join(pluginsRoot, 'sample-review-pack'));
    expect(pack?.name).toBe('sample-review-pack');
    expect(pack?.include).toEqual(['sample-two-axis-review', 'sample-github-pr-review']);
  });
});
