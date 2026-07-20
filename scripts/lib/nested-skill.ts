import { existsSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Returns true if `skillFile` lives inside another skill's directory.
 * A nested skill is a SKILL.md whose any ancestor directory also contains a SKILL.md.
 */
export function isNestedSkill(skillFile: string, skillsDir: string): boolean {
  const relFromSkills = relative(skillsDir, skillFile).replace(/\\/g, "/");
  const parts = relFromSkills.split("/");
  for (let depth = 1; depth < parts.length - 1; depth++) {
    const ancestor = join(skillsDir, ...parts.slice(0, depth), "SKILL.md");
    if (existsSync(ancestor)) return true;
  }
  return false;
}
