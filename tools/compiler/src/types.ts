export interface Skill {
  name: string;
  root: string; // relative to skills root, e.g. code-review/two-axis-review
  dir: string; // absolute path to skill directory
  category: string[];
  description: string;
  source: string;
  body: string;
  frontmatter: Record<string, string | number | boolean | string[]>;
  links: SkillLink[];
}

export type SkillLinkType = 'macro' | 'file';

export interface SkillLink {
  text: string;
  targetName: string;
  raw: string;
  type: SkillLinkType;
}

export type PluginDependency = string | { name: string; version?: string; marketplace?: string };

export interface PluginManifest {
  name: string;
  description?: string;
  include: string[];
  targets: string[];
  dependencies?: PluginDependency[];
  [key: string]: unknown;
}

export interface CompilerOptions {
  workspaceRoot: string;
  skillsRoot: string;
  pluginsRoot: string;
  projectRoot: string;
  target: string;
  outDir: string;
  /**
   * How to handle dependencies:
   * - `inline`: bundle all transitive dependency skills into the output (default)
   * - `external`: emit only the requested skills; references stay as `$skill{...}`
   */
  dependencies?: 'inline' | 'external';
  /**
   * Overrides `metadata.source` for published skills (e.g. ThePlenkov/skills).
   */
  publicSource?: string;
}
