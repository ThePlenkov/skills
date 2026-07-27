import path from 'node:path';
import { build } from './build.js';

function main(): void {
  const args = process.argv.slice(2);
  const getArg = (name: string): string | undefined => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const workspaceRoot = path.resolve(getArg('--workspace-root') ?? process.cwd());
  const project = getArg('--project');
  const target = getArg('--target') ?? 'claude';
  const outDir = getArg('--out-dir');
  const dependencies = getArg('--dependencies') as 'inline' | 'external' | undefined;

  if (!project) {
    console.error('Usage: skills-compiler --project <path> --target <target> --out-dir <path> [--workspace-root <path>] [--dependencies inline|external]');
    process.exit(1);
  }

  const projectRoot = path.resolve(workspaceRoot, project);
  const finalOutDir = outDir
    ? path.resolve(workspaceRoot, outDir)
    : path.resolve(workspaceRoot, 'dist', project, target);

  build({
    workspaceRoot,
    skillsRoot: path.join(workspaceRoot, 'skills'),
    pluginsRoot: path.join(workspaceRoot, 'plugins'),
    projectRoot,
    target,
    outDir: finalOutDir,
    dependencies,
  });

  console.log(`Built ${target} for ${project} -> ${finalOutDir}`);
}

main();
