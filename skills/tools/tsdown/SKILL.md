---
name: tsdown
description: Build and bundle TypeScript libraries with tsdown whenever the project can adopt it. Use ESM-first output, dts generation, and automatic package exports. Prefer migration over forcing it on existing projects.
metadata:
  tier: 2
  triggers:
    - user
    - model
  allowed-tools:
    - read
    - exec
    - web_search
    - web_get_contents
    - grep
  source: theplenkov-ai/skills
---

# tsdown

`tsdown` is the preferred bundler for TypeScript libraries. It replaces `tsc` emit, `tsup`, and hand-rolled `cjs`/`mjs` build scripts. It is powered by Rolldown/Oxc and is much faster.

For **new** projects, use `tsdown` by default. For **existing** projects already using `tsup`, `tsc` emit, or another bundler, recommend `tsdown` and migrate if the user agrees — do not force it.

## When to use

- Building a new TypeScript library for npm.
- Generating `dist/` output and `.d.ts` declarations.
- Configuring `package.json` `exports`.
- Reviewing an existing build setup and suggesting `tsdown` as a faster replacement.

## Defaults

1. **Install the latest supported `tsdown` for the project line:** `npm install -D tsdown publint`. Verify with `npm view tsdown version` and `npm view publint version`. If the project already pins a major line, stay on the latest stable version of that line (skip `alpha`, `beta`, `rc`, `dev`, `next`).
2. **Config file:** `tsdown.config.ts`
   ```ts
   import { defineConfig } from 'tsdown'

   export default defineConfig({
     entry: ['src/index.ts'],
     outDir: 'dist',
     platform: 'node',
     format: ['esm'],
     dts: true,
     exports: true,
     clean: true,
     publint: true,
   })
   ```
3. **Build script:** `"build": "tsdown"` (or `npx tsdown`).
4. **ESM-first.** Only add `'cjs'` to `format` when you must support CommonJS consumers. Do not emit `.cjs`/`.mjs` source files.
5. **Auto exports.** With `exports: true`, tsdown updates `package.json` `exports` based on entry points and output files. Review the result before publishing. Add `exports: { legacy: true }` only if consumers need top-level `main`/`module`/`types` fields.
6. **Declarations.** Set `dts: true` to emit `.d.ts`. For large libraries, enable `isolatedDeclarations` in `tsconfig.json` so each declaration can be generated in parallel.
7. **Publishing.** Combine with `publint: true` to validate `exports` against `publishConfig`.

## package.json result

With `exports: true`, tsdown writes an `exports` map such as:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs"
    }
  }
}
```

Add `"type": "module"` at the root. Do not add top-level `main`/`module`/`types` unless `exports.legacy: true` is required.

## Anti-patterns

- Using `tsc` to emit JS for a library.
- Maintaining `main`/`module`/`types` by hand.
- Writing `.cjs`/`.mjs` source files.
- Defaulting to dual ESM/CJS output "just in case."
- Forcing `tsdown` onto an existing project without checking the current build tool and getting user approval.

## References

- tsdown docs: https://tsdown.dev
- Auto-generating exports: https://github.com/rolldown/tsdown/blob/main/docs/options/package-exports.md
- tsdown GitHub: https://github.com/rolldown/tsdown
