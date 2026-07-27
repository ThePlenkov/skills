export interface PublicSkillPublication {
  /** Skill name (must be unique across the skills/ tree). */
  skill: string;
  /** Target repository in owner/repo format. */
  repo: string;
  /** Compiler target format. */
  format: 'skills-sh' | 'claude' | 'codex' | 'agents' | 'obsidian';
}

const publications: PublicSkillPublication[] = [
  { skill: 'drill', repo: 'ThePlenkov/skills', format: 'skills-sh' },
];

export default publications;
