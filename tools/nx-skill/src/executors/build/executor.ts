import type { ExecutorContext } from '@nx/devkit';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from '@theplenkov/skills-compiler';

export interface BuildExecutorOptions {
  target?: 'skills-sh' | 'claude' | 'codex' | 'agents' | 'obsidian';
  outDir: string;
  publicSource?: string;
  dependencies?: 'inline' | 'external';
}

async function loadSkillMetadata(workspaceRoot: string) {
  const configPath = path.join(workspaceRoot, 'skills.config.ts');
  try {
    const mod = (await import(pathToFileURL(configPath).href)) as {
      skillMetadata?: Record<string, { frontmatter?: Record<string, unknown> }>;
    };
    return mod.skillMetadata;
  } catch {
    return undefined;
  }
}

export default async function buildExecutor(
  options: BuildExecutorOptions,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
  const projectRoot = context.projectsConfigurations?.projects[context.projectName!]?.root;
  if (!projectRoot) {
    throw new Error(`Cannot resolve project root for ${context.projectName}`);
  }

  const workspaceRoot = context.root;
  const skillsRoot = path.join(workspaceRoot, 'skills');
  const pluginsRoot = path.join(workspaceRoot, 'plugins');
  const outDir = path.isAbsolute(options.outDir)
    ? options.outDir
    : path.resolve(workspaceRoot, options.outDir);

  fs.mkdirSync(outDir, { recursive: true });

  build({
    workspaceRoot,
    skillsRoot,
    pluginsRoot,
    projectRoot: path.resolve(workspaceRoot, projectRoot),
    target: options.target ?? 'skills-sh',
    outDir,
    publicSource: options.publicSource,
    dependencies: options.dependencies ?? 'inline',
    skillMetadata: await loadSkillMetadata(workspaceRoot),
  });

  return { success: true };
}
