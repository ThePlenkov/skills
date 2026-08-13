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
              lint: {
                cache: true,
                inputs: [
                  '{projectRoot}/**/*.md',
                  '{workspaceRoot}/.markdownlint.json',
                ],
                command: `npx markdownlint-cli2 '{projectRoot}/**/*.md' --config .markdownlint.json`,
              },
              validate: {
                cache: true,
                inputs: [
                  '{projectRoot}/SKILL.md',
                  '{projectRoot}/agents/openai.yaml',
                  '{workspaceRoot}/.github/skill-schema.json',
                  '{workspaceRoot}/.github/openai-metadata-schema.json',
                ],
                command: `tsx scripts/validate-skill.ts {projectRoot}`,
              },
              'os-check': {
                cache: true,
                inputs: [
                  '{projectRoot}/**/*.md',
                  '{projectRoot}/**/*.sh',
                  '{workspaceRoot}/scripts/check-os-independence.ts',
                ],
                command: `tsx scripts/check-os-independence.ts --skill {projectRoot} --warn-only`,
              },
              'size-check': {
                cache: true,
                inputs: ['{projectRoot}/SKILL.md'],
                command: `tsx scripts/check-skill-size.ts --skill {projectRoot} --warn-only`,
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
