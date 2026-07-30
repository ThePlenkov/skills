import { defaultSkillMetadata, skillMetadata } from "../../skills.config.ts";

export type Frontmatter = Record<string, unknown>;

export function getField(frontmatter: Frontmatter, key: string): unknown {
  const metadata =
    frontmatter.metadata && typeof frontmatter.metadata === 'object' && !Array.isArray(frontmatter.metadata)
      ? (frontmatter.metadata as Frontmatter)
      : undefined;
  return metadata?.[key] ?? frontmatter[key];
}

function extractMetadata(frontmatter: Frontmatter): { top: Frontmatter; meta: Frontmatter } {
  const metaObj =
    frontmatter.metadata && typeof frontmatter.metadata === 'object' && !Array.isArray(frontmatter.metadata)
      ? (frontmatter.metadata as Frontmatter)
      : {};
  const { metadata: _, ...top } = frontmatter;
  return { top, meta: metaObj };
}

export function mergeConfigFrontmatter(name: string, frontmatter: Frontmatter): Frontmatter {
  const config = skillMetadata[name];
  if (!config || !config.frontmatter) {
    throw new Error(`Skill '${name}' is missing a skills.config.ts entry`);
  }
  const defaultParts = extractMetadata((defaultSkillMetadata.frontmatter ?? {}) as Frontmatter);
  const currentParts = extractMetadata(frontmatter);
  const configParts = extractMetadata(config.frontmatter as Frontmatter);
  return {
    ...frontmatter,
    ...defaultParts.top,
    ...configParts.top,
    metadata: { ...defaultParts.meta, ...currentParts.meta, ...configParts.meta },
  };
}
