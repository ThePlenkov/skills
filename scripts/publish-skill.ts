import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { build, discoverSkills } from '@theplenkov/skills-compiler';
import { repositories } from '../public-skills.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = process.env.GITHUB_WORKSPACE ?? path.resolve(__dirname, '..');
const skillName = process.env.SKILL;
const repo = process.env.REPO;
const format = process.env.FORMAT;
const ghToken = process.env.GH_TOKEN;

if (!skillName || !repo || !format || !ghToken) {
  throw new Error('SKILL, REPO, FORMAT and GH_TOKEN env vars are required');
}

const resolvedRepo = (repositories as Record<string, string>)[repo] ?? repo;

const skillsRoot = path.join(workspaceRoot, 'skills');
const pluginsRoot = path.join(workspaceRoot, 'plugins');
const skillsByName = discoverSkills(skillsRoot);
const skill = skillsByName.get(skillName);
if (!skill) {
  throw new Error(`Skill '${skillName}' not found under ${skillsRoot}`);
}

const buildDir = fs.mkdtempSync(path.join(process.cwd(), 'build-'));
build({
  workspaceRoot,
  skillsRoot,
  pluginsRoot,
  projectRoot: skill.dir,
  target: format,
  outDir: buildDir,
  publicSource: resolvedRepo,
});

const targetRepoDir = fs.mkdtempSync(path.join(process.cwd(), 'target-repo-'));
const targetSkillPath = path.join('skills', skillName);

try {
  execSync('gh auth setup-git');
  execSync(`gh repo clone ${resolvedRepo} ${targetRepoDir} -- --depth 1`);

  const destPath = path.join(targetRepoDir, targetSkillPath);
  fs.rmSync(destPath, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.cpSync(buildDir, destPath, { recursive: true });

  const status = execSync('git status --porcelain', { cwd: targetRepoDir, encoding: 'utf8' });
  if (status.trim()) {
    execSync('git config user.name "github-actions[bot]"', { cwd: targetRepoDir });
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"', { cwd: targetRepoDir });
    execSync('git add .', { cwd: targetRepoDir });
    execSync(`git commit -m "publish(skill): ${skillName} (${format}) [skip ci]"`, { cwd: targetRepoDir });
    execSync('git push', { cwd: targetRepoDir });
    console.log(`Published ${skillName} to ${resolvedRepo}:${targetSkillPath}`);
  } else {
    console.log(`No changes for ${skillName} in ${resolvedRepo}; nothing to publish`);
  }
} finally {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.rmSync(targetRepoDir, { recursive: true, force: true });
}
