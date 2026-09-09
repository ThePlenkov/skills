#!/usr/bin/env bun
/**
 * Apply local patches to the vendored nx.ts submodule.
 *
 * The submodule is pinned to a specific SHA of nx-devkit/nx.ts. Three fixes
 * are needed for Nx to load the plugins correctly but are not yet committed
 * upstream. This script applies them idempotently after `git submodule update
 * --init` so that `build:nx-plugins` builds patched source.
 *
 * Patches:
 * 1. package.json exports: point `default` at dist/*.mjs (Node can't strip
 *    types from src/*.ts under node_modules)
 * 2. shouldSkipPath: skip `vendor/` so plugins don't scan SKILL.md inside
 *    the submodule itself
 * 3. createNodesV2: use projectRoot as the key in the projects map (Nx
 *    expects project root, not injective project name)
 *
 * Once these are upstreamed and the submodule pointer is updated, this
 * script can be deleted.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const SUBMODULE = resolve(REPO_ROOT, "vendor/nx.ts");

const PKGS = [
  { dir: "packages/skill", name: "@nx-devkit/skill" },
  { dir: "packages/skillspector", name: "@nx-devkit/skillspector" },
] as const;

function patchFile(path: string, check: (content: string) => boolean, apply: (content: string) => string): void {
  if (!existsSync(path)) {
    console.warn(`  ! not found: ${path}`);
    return;
  }
  const original = readFileSync(path, "utf8");
  if (check(original)) {
    console.log(`  ✓ already patched: ${path}`);
    return;
  }
  const patched = apply(original);
  writeFileSync(path, patched, "utf8");
  console.log(`  ✓ patched: ${path}`);
}

function main(): void {
  if (!existsSync(SUBMODULE)) {
    console.error(`vendor/nx.ts not found — run: git submodule update --init`);
    process.exit(1);
  }

  console.log("Applying submodule patches...");

  for (const pkg of PKGS) {
    const pkgDir = resolve(SUBMODULE, pkg.dir);

    // Patch 1: package.json exports — dist instead of src for default
    const pkgJsonPath = resolve(pkgDir, "package.json");
    patchFile(
      pkgJsonPath,
      (c) => c.includes('"./dist/index.mjs"'),
      (c) =>
        c
          .replace('"main": "./src/index.ts"', '"main": "./dist/index.mjs"')
          .replace('"module": "./src/index.ts"', '"module": "./dist/index.mjs"')
          .replace('"types": "./src/index.ts"', '"types": "./dist/index.d.mts"')
          .replace(
            '".": { "types": "./src/index.ts", "default": "./src/index.ts" }',
            '".": { "@nx/nx-source": "./src/index.ts", "types": "./dist/index.d.mts", "default": "./dist/index.mjs" }',
          )
          .replace(
            '"./plugin": { "types": "./src/plugin.ts", "default": "./src/plugin.ts" }',
            '"./plugin": { "@nx/nx-source": "./src/plugin.ts", "types": "./dist/plugin.d.mts", "default": "./dist/plugin.mjs" }',
          ),
    );

    // Patch 2 & 3: plugin.ts — vendor skip + project root key
    const pluginPath = resolve(pkgDir, "src/plugin.ts");
    if (pkg.name === "@nx-devkit/skill") {
      patchFile(
        pluginPath,
        (c) => c.includes("rel.startsWith('vendor/')"),
        (c) => {
          // Patch 2: add vendor/ to shouldSkipPath (after node_modules check)
          if (!c.includes("rel.startsWith('vendor/')")) {
            c = c.replace(
              "if (rel.includes('node_modules')) {\n    return true\n  }",
              "if (rel.includes('node_modules')) {\n    return true\n  }\n\n  if (rel.startsWith('vendor/')) {\n    return true\n  }",
            );
          }
          // Patch 3: use projectRoot as key, add name field
          c = c.replace(
            /projects:\s*\{\s*\n\s*\[projectName\]:\s*\{\s*\n\s*targets,/,
            "projects: {\n              [projectRoot]: {\n                name: projectName,\n                root: projectRoot,\n                targets,",
          );
          return c;
        },
      );
    } else {
      patchFile(
        pluginPath,
        (c) => c.includes("projectRoot.startsWith('vendor/')"),
        (c) => {
          // Patch 2: add vendor/ to shouldSkipPath
          if (!c.includes("projectRoot.startsWith('vendor/')")) {
            c = c.replace(
              "if (projectRoot.split('/').includes('..')) return true",
              "if (projectRoot.startsWith('vendor/')) return true\n  if (projectRoot.split('/').includes('..')) return true",
            );
          }
          // Patch 3: use projectRoot as key, add name field
          c = c.replace(
            /const project:\s*ProjectConfiguration\s*=\s*\{\s*\n\s*root:/,
            "const project: ProjectConfiguration = {\n        name: projectName,\n        root:",
          );
          c = c.replace(
            "[projectName]: project,",
            "[projectRoot]: project,",
          );
          return c;
        },
      );
    }
  }

  console.log("Submodule patches applied.");
}

main();
