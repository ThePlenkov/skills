/**
 * Nx plugin entry point — inferred tasks via CreateNodes.
 *
 * For every directory containing SKILL.md (the marker), a project
 * is inferred with a scan target pointing at this plugin's
 * executor. No project.json files in the host repo.
 */
import {
  type CreateNodes,
  type CreateNodesResult,
  type ProjectConfiguration,
} from '@nx/devkit';
import { readdirSync, realpathSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface SkillspectorPluginOptions {
  /** Marker filename that identifies a skill directory. */
  skillsGlob?: string;
  /** Target name to assign to each inferred project. */
  targetName?: string;
}

const defaultOptions: Required<SkillspectorPluginOptions> = {
  skillsGlob: 'SKILL.md',
  targetName: 'scan',
};

/** Walk root looking for dirs that contain `marker` at top level.
 *  Uses realpathSync to avoid infinite loops through self-symlinks.
 */
function* walk(root: string, marker: string, maxDepth = 3): Generator<string> {
  const seen = new Set<string>();
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  while (stack.length > 0) {
    const { dir, depth } = stack.pop()!;
    if (depth > maxDepth) continue;
    let real: string;
    try {
      real = realpathSync(dir);
    } catch {
      continue;
    }
    if (seen.has(real)) continue;
    seen.add(real);
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.nx' || entry.name === '.git') continue;
      const full = join(dir, entry.name);
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        stack.push({ dir: full, depth: depth + 1 });
      } else if (entry.name === marker) {
        yield join(dir, entry.name);
      }
    }
  }
}

/** Normalize: workspace-relative path with forward slashes, no leading `./`. */
function toRel(abs: string, workspaceRoot: string): string {
  const rel = relative(workspaceRoot, abs);
  return rel.startsWith('.') ? rel.slice(2) : rel;
}

export const createNodes: CreateNodes<SkillspectorPluginOptions> = [
  '**/SKILL.md',
  async (_configFiles, options, context): Promise<Array<readonly [string, CreateNodesResult]>> => {
    const opts = { ...defaultOptions, ...options };

    // Walk the workspace for skill directories. Dedupe by skill name
    // so symlinks/hardlinks to the same skill don't produce two projects.
    const projects: Record<string, ProjectConfiguration> = {};
    const markers: Array<{ marker: string; root: string }> = [];

    for (const markerAbs of walk(context.workspaceRoot, opts.skillsGlob)) {
      const dirAbs = markerAbs.replace(new RegExp(`[/\\\\]${opts.skillsGlob.replace('.', '\\.')}$`), '');
      const root = toRel(dirAbs, context.workspaceRoot);
      const markerRel = toRel(markerAbs, context.workspaceRoot);
      const name = root.split(sep).filter(Boolean).pop();
      if (!name) continue;
      if (Object.values(projects).some(p => p.name === name)) continue;
        if (!projects[root]) {
        projects[root] = {
          name,
          root,
          targets: {
            [opts.targetName]: {
              executor: '@theplenkov/nx-skillspector:scan',
              options: { path: root, workspaceRoot: context.workspaceRoot, ...(process.env.SARIF_OUT ? { sarif: process.env.SARIF_OUT } : {}) },
            },
          },
        };
        markers.push({ marker: markerRel, root });
      }
    }

    return markers.map(({ marker, root }) => {
      const result: CreateNodesResult = { projects: { [root]: projects[root]! } };
      return [marker, result] as const;
    });
  },
];

export default createNodes;

