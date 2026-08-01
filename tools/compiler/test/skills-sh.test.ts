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

  it('overwrites source for the public mirror when canonical is the repo default', () => {
    const out = normalizeFrontmatter(
      { name: 'x', source: 'theplenkov-ai/skills' },
      'ThePlenkov/skills'
    );
    const parsed = parse(out) as Record<string, unknown>;
    expect(parsed.source).toBe('ThePlenkov/skills');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('ThePlenkov/skills');
  });

  it('overwrites source when canonical differs only in casing', () => {
    const out = normalizeFrontmatter(
      { name: 'x', source: 'ThePlenkov-AI/skills' },
      'ThePlenkov/skills'
    );
    const parsed = parse(out) as Record<string, unknown>;
    expect(parsed.source).toBe('ThePlenkov/skills');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('ThePlenkov/skills');
  });

  it('preserves fork source when publicSource is provided', () => {
    const out = normalizeFrontmatter(
      { name: 'x', source: 'fork/skills' },
      'ThePlenkov/skills'
    );
    const parsed = parse(out) as Record<string, unknown>;
    expect(parsed.source).toBe('fork/skills');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('fork/skills');
  });

  it('normalises publicSource forms like .git and https URLs', () => {
    const out = normalizeFrontmatter(
      { name: 'x', source: 'theplenkov-ai/skills' },
      'https://github.com/ThePlenkov/skills.git'
    );
    const parsed = parse(out) as Record<string, unknown>;
    expect(parsed.source).toBe('ThePlenkov/skills');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('ThePlenkov/skills');
  });

  it('strips query strings and fragments from https publicSource', () => {
    const out = normalizeFrontmatter(
      { name: 'x', source: 'theplenkov-ai/skills' },
      'https://github.com/ThePlenkov/skills.git?ref=main#readme'
    );
    const parsed = parse(out) as Record<string, unknown>;
    expect(parsed.source).toBe('ThePlenkov/skills');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('ThePlenkov/skills');
  });

  it('defaults source when missing or invalid', () => {
    const out = normalizeFrontmatter({ name: 'x' });
    const parsed = parse(out) as Record<string, unknown>;
    expect(parsed.source).toBe('theplenkov-ai/skills');
    expect((parsed.metadata as Record<string, unknown>).source).toBe('theplenkov-ai/skills');
  });

  it('throws for malformed publicSource values', () => {
    expect(() => normalizeFrontmatter({ name: 'x' }, 'not-a-shorthand')).toThrow();
    expect(() => normalizeFrontmatter({ name: 'x' }, 'owner/repo/extra')).toThrow();
    expect(() => normalizeFrontmatter({ name: 'x' }, 'https://example.com/')).toThrow();
    expect(() => normalizeFrontmatter({ name: 'x' }, 'https://example.com/owner/repo')).toThrow();
  });
});
