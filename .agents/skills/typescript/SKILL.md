---
name: typescript
description: Use the latest supported TypeScript for the current major line. The latest stable TypeScript is recommended for new projects; otherwise stay on the installed line. Source is .ts, build with tsdown, and avoid legacy emit patterns.
---

# typescript

Use the `typescript` package already installed in the project, and stay on the latest supported version of its major line. The **latest stable TypeScript major** is the recommendation for new projects, but it is not a hard requirement — forcing a major upgrade without approval is an anti-pattern.

Before adopting the latest stable major, verify the project's toolchain supports it. Tools that consume the TypeScript compiler API (`typescript-eslint`, `vue-tsc`, `svelte-check`, `astro check`, `ts-jest`, `ts-morph`) may not support a new major until it has a stable programmatic API. If the toolchain is not ready, stay on the latest compatible major or use a side-by-side alias for the toolchain.

## When to use

- Adding or configuring TypeScript in a project.
- Choosing between `tsc`, `tsgo`, `tsdown`, `tsup`, `ts-node`.
- Writing `tsconfig.json` for Node.js or library targets.

## Defaults

- **Detect the current TypeScript line.** Read `package.json` (`devDependencies`, `dependencies`, `peerDependencies`).
  - If `typescript` is missing: **recommend** the latest stable major (`npm install -D typescript @types/node`). Verify with `npm view typescript version` and `npm view @types/node version`.
  - If `typescript` is pinned to a major line: stay on the latest **stable** patch/minor of that line (skip `alpha`, `beta`, `rc`, `dev`, `next`). Resolve it with `npm view typescript versions --json` and filter by the current major.
- **Type-check only:** `npx tsc --noEmit` in CI and local checks. Use the `tsc` binary from the installed `typescript` package. Do not use `tsc` to emit JS for libraries — use `tsdown`.
- **Native preview (optional):** `npm install -D @typescript/native-preview` then `npx tsgo --project ./tsconfig.json`. Use only for preview/nightly features or when the user explicitly asks.
- **Source files:** Use `.ts`, or `.tsx` when the file contains JSX. Do not write `.mts`/`.cts`/`.cjs`/`.mjs` source.
- If you enable `isolatedDeclarations`, also set `declaration: true`.
- **tsconfig defaults (Node/ESM):**
  ```json
  {
    "compilerOptions": {
      "target": "ESNext",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "lib": ["ESNext"],
      "strict": true,
      "noEmit": true,
      "verbatimModuleSyntax": true,
      "erasableSyntaxOnly": true,
      "rewriteRelativeImportExtensions": true,
      "allowImportingTsExtensions": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true
    }
  }
  ```
- If you enable `isolatedDeclarations`, also set `declaration: true`.
- If the installed TypeScript major is older than the one that introduced an option (e.g., `erasableSyntaxOnly`, `rewriteRelativeImportExtensions`, `allowImportingTsExtensions`, `isolatedDeclarations`), remove the unsupported options from `tsconfig.json` until you upgrade TypeScript.
- **For libraries:** keep `noEmit: true` for `tsc`, and configure `tsdown` to emit `esm` (and `cjs` only if required) with `dts` and `exports` auto-generation.

## Why not tsc for emit?

`tsc` is a type-checker and transpiler, but for published libraries it produces one format at a time and does not manage `package.json` exports. `tsdown` builds multiple formats, generates declarations, and keeps `exports` in sync. Use `tsc` for type checking, `tsdown` for bundling.

## Anti-patterns

- `tsc` emitting `.js` into `dist/` and hand-maintaining `main`/`module`/`types`.
- `tsup` for new projects when `tsdown` is available.
- Writing `.mts`/`.cts` source files.
- Using `ts-node` in production or CI.
- Forcing the latest TypeScript major onto a project pinned to an older line without asking.
- Hardcoding a numeric Node version in `tsconfig` `lib`/`types` comments or package docs instead of using the current LTS.

## References

- TypeScript documentation: https://www.typescriptlang.org/docs/
- TypeScript native preview / tsgo: https://github.com/microsoft/typescript-go
- Node.js TypeScript support: https://nodejs.org/api/typescript.html
