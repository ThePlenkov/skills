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
import { realpathSync } from 'node:fs';
import { dirname, relative, sep } from 'node:path';

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

/** Normalize: workspace-relative path with forward slashes, no leading `./`. */
function toRel(abs: string, workspaceRoot: string): string {
  const rel = relative(workspaceRoot, abs);
  return rel.startsWith('.') ? rel.slice(2) : rel;
}

export const createNodes: CreateNodes<SkillspectorPluginOptions> = [
  '**/SKILL.md',
  async (configFiles, options, context): Promise<Array<readonly [string, CreateNodesResult]>> => {
    const opts = { ...defaultOptions, ...options };

    // Use Nx's configFiles as the primary source — it's already
    // globbed and deduped by the daemon, so we skip the redundant
    // synchronous readdirSync walk that the previous version did.
    //
    // Dedup by realpath so cyclic symlinks (e.g. `act/act → act`)
    // don't produce duplicate projects even when Nx reports both
    // paths. Dedupe by name as a final tiebreaker so a real
    // duplicate still doesn't yield two projects.
    const seen = new Set<string>();
    const byName = new Map<string, string>();
    const projects: Record<string, ProjectConfiguration> = {};
    const markers: Array<{ marker: string; root: string }> = [];

    for (const markerAbs of configFiles) {
      let realMarker: string;
      try {
        realMarker = realpathSync(markerAbs);
      } catch {
        realMarker = markerAbs;
      }
      if (seen.has(realMarker)) continue;
      seen.add(realMarker);

      const dirAbs = dirname(markerAbs);
      const root = toRel(dirAbs, context.workspaceRoot);
      const markerRel = toRel(markerAbs, context.workspaceRoot);
      const name = root.split(sep).filter(Boolean).pop();
      if (!name) continue;
      if (byName.has(name)) continue;
      byName.set(name, root);

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

    return markers.map(({ marker, root }) => {
      const result: CreateNodesResult = { projects: { [root]: projects[root]! } };
      return [marker, result] as const;
    });
  },
];

export default createNodes;
