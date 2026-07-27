export type RepositoryAlias = string;

export const repositories: Record<RepositoryAlias, string> = {
  'public-skills': 'ThePlenkov/skills',
};

export interface PublicSkillPublication {
  /** Skill name (must be unique across the skills/ tree). */
  skill: string;
  /** Repository alias (from `repositories`) or full `owner/repo` string. */
  repo: RepositoryAlias | string;
  /** Compiler target format. */
  format: 'skills-sh' | 'claude' | 'codex' | 'agents' | 'obsidian';
}

const publications: PublicSkillPublication[] = [
  { skill: 'drill', repo: 'public-skills', format: 'skills-sh' },
];

export default publications;
