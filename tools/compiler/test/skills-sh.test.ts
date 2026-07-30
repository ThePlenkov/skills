import { describe, it, expect } from 'bun:test';
import { parse } from 'yaml';
import { normalizeFrontmatter } from '../src/targets/skills-sh.js';

describe('normalizeFrontmatter', () => {
  it('preserves required top-level fields and keeps source canonical', () => {
    const out = normalizeFrontmatter({
      name: 'skillmaker',
      description: 'Create skills',
      tier: 2,
      triggers: ['user', 'model'],
      source: 'theplenkov-ai/skills',
    });
    const parsed = parse(out) as Record<string, unknown>;
    expect(parsed.name).toBe('skillmaker');
    expect(parsed.description).toBe('Create skills');
    expect(parsed.tier).toBe(2);
    expect(parsed.triggers).toEqual(['user', 'model']);
    expect(parsed.source).toBe('theplenkov-ai/skills');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('theplenkov-ai/skills');
  });

  it('lets publicSource override metadata.source while keeping top-level source canonical', () => {
    const out = normalizeFrontmatter(
      { name: 'x', source: 'theplenkov-ai/skills' },
      'ThePlenkov/skills'
    );
    const parsed = parse(out) as Record<string, unknown>;
    expect(parsed.source).toBe('theplenkov-ai/skills');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('theplenkov-ai/skills');
    expect((parsed.metadata as Record<string, unknown>).publicSource).toBe('ThePlenkov/skills');
  });

  it('defaults source when missing or invalid', () => {
    const out = normalizeFrontmatter({ name: 'x' });
    const parsed = parse(out) as Record<string, unknown>;
    expect(parsed.source).toBe('theplenkov-ai/skills');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('theplenkov-ai/skills');
  });

  it('throws for malformed publicSource values', () => {
    expect(() => normalizeFrontmatter({ name: 'x' }, 'https://github.com/foo/bar')).toThrow();
    expect(() => normalizeFrontmatter({ name: 'x' }, 'foo/bar.git')).toThrow();
    expect(() => normalizeFrontmatter({ name: 'x' }, 'not-a-shorthand')).toThrow();
  });

  it('hoists tier and triggers from metadata to top-level when not already present', () => {
    const out = normalizeFrontmatter({
      name: 'my-skill',
      description: '...',
      metadata: { tier: 1, triggers: ['user'], source: 'theplenkov-ai/skills' },
    });
    const parsed = parse(out) as Record<string, unknown>;
    expect(parsed.tier).toBe(1);
    expect(parsed.triggers).toEqual(['user']);
    expect(parsed.source).toBe('theplenkov-ai/skills');
    expect((parsed.metadata as Record<string, unknown>).tier).toBe(1);
    expect((parsed.metadata as Record<string, unknown>).triggers).toEqual(['user']);
  });
});
