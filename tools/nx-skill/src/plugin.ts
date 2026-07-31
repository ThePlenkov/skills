import type { CreateNodes, CreateNodesResult } from '@nx/devkit';
import * as path from 'node:path';

export const createNodes: CreateNodes = [
  '**/SKILL.md',
  async (skillFiles, _, context): Promise<Array<readonly [string, CreateNodesResult]>> => {
    return skillFiles.map((skillFile) => {
      const skillDir = path.dirname(path.resolve(context.workspaceRoot, skillFile));
      const projectName = path.basename(skillDir);
      const relRoot = path.relative(context.workspaceRoot, skillDir).replace(/\\/g, '/');
      const result: CreateNodesResult = {
        projects: {
          [projectName]: {
            name: projectName,
            root: relRoot,
            targets: {
              build: {
                executor: '@theplenkov/nx-skill:build',
                outputs: ['{workspaceRoot}/.build/skills/{projectName}'],
                options: {
                  target: 'skills-sh',
                  outDir: `.build/skills/${projectName}`,
                },
              },
            },
          },
        },
      };
      return [skillFile, result] as const;
    });
  },
];

export default createNodes;
