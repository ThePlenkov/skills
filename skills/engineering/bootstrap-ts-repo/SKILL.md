---
name: bootstrap-ts-repo
description: "Bootstrap a new TypeScript repository with native TS, tsdown, oxlint, biome, husky, and Nx. Use the current Node LTS as the minimum runtime, the latest supported versions for each major line, and avoid .cjs/.mjs source and legacy toolchains."
tier: 2
triggers: [user, model]
allowed-tools:
  - read
  - exec
  - web_search
  - web_get_contents
  - edit
  - write
  - grep
source: theplenkov-ai/skills
---

# bootstrap-ts-repo

Create a new TypeScript repository the modern way: native Node/TS execution, `tsdown` for building, `oxlint` for linting, `biome` for formatting, `husky` for hooks, and `Nx` for the monorepo graph. **Node.js LTS is the minimum runtime.** For new repos, recommend the latest stable majors (current Node LTS, latest stable TypeScript, tsdown). For existing packages added to the monorepo, respect their current major line and stay on the latest supported version for that line.

## When to use

- Starting a new TypeScript project or monorepo.
- Scaffolding a new package inside an existing workspace.
- An agent wants to emit `.cjs`/`.mjs` or default to `tsc`/`eslint`/`prettier`.

## Step 1: Determine the current Node LTS

Before writing any Node code, fetch the current LTS from the registry:

```sh
NODE_LTS=$(curl -sL https://nodejs.org/dist/index.json |
  jq -r 'map(select(.lts != false)) | sort_by(.version | sub("^v";"") | split(".") | map(tonumber)) | last | .version')
NODE_LTS=${NODE_LTS#v}
echo "$NODE_LTS"
```

Or with Node:

```sh
node -e "fetch('https://nodejs.org/dist/index.json').then(r=>r.json()).then(d=>{const l=[...d].filter(x=>x.lts).sort((a,b)=>{const av=a.version.slice(1).split('.').map(Number), bv=b.version.slice(1).split('.').map(Number); for(let i=0;i<3;i++){const d=(bv[i]||0)-(av[i]||0); if(d) return d} return 0})[0]; console.log(l.version.slice(1))})"
```

Use this value when setting `engines.node` (`>=${NODE_LTS}`) and CI `node-version` (`lts/*` with `check-latest: true`). Do not hardcode a numeric Node version.

## Step 2: Scaffold with Nx

Resolve the latest stable `create-nx-workspace` version from the registry and pin it:

```sh
NX_VERSION=$(npm view create-nx-workspace version)
```

Choose the workspace shape:

- **Single package:** `npx create-nx-workspace@${NX_VERSION} <repo> --preset=ts-standalone --workspaces`
- **Monorepo:** `npx create-nx-workspace@${NX_VERSION} <repo> --template nrwl/typescript-template --workspaces` (or `--preset=ts --workspaces` if the template is unavailable)

This gives you `nx.json`, `package.json`, and a `packageManager`-based workspace.

## Step 3: Add the modern toolchain

Install the latest versions and pin the resolved versions:

```bash
npm install -D --save-exact typescript @types/node tsdown oxlint @biomejs/biome husky lint-staged publint
```

For an exact pin when the project already has a major line, resolve the version first and install it exactly: `npm install -D --save-exact typescript@<resolved> @types/node@<resolved> ...`.

For an **existing** package, read its `package.json` first:

- `engines.node` → must be at least the current LTS version. If it is below the current LTS, bump it to `>=<current-lts-version>` and run tests.
- `devDependencies.typescript` / `dependencies.typescript` / `peerDependencies.typescript` → if pinned to a major line, stay on the latest **stable** patch/minor of that line (skip `alpha`, `beta`, `rc`, `dev`, `next`). If missing, recommend the latest stable TypeScript, but first verify the project's toolchain (typescript-eslint, vue-tsc, svelte-check, astro check, ts-jest, ts-morph) supports that major.
- Repeat the same logic for `tsdown`, `oxlint`, `biome`, etc.

Verify with `npm view <pkg> versions --json` and select the highest stable version matching the current major line before committing.

If the installed TypeScript major is older than the one that introduced an option in the tsconfig template (e.g., `isolatedDeclarations` or `erasableSyntaxOnly`), omit the unsupported options until TypeScript is upgraded.

## Step 4: tsconfig

Root `tsconfig.base.json` (or per-project `tsconfig.json`):

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
    "isolatedDeclarations": true,
    "declaration": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`isolatedDeclarations: true` lets `tsdown` generate `.d.ts` with oxc-transform.

## Step 5: tsdown config

`tsdown.config.ts` at package root:

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

Build script: `"build": "tsdown"`.
Type-check script: `"typecheck": "tsc --noEmit"`.

If the project already uses `tsup`/`tsc` emit, recommend `tsdown` but do not force the migration without approval.

## Step 6: Linting and formatting

Use `oxlint` for linting, `biome` for formatting and import sorting. Do not run `biome lint` if `oxlint` is the linter.

`package.json` scripts:

```json
{
  "scripts": {
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "format": "biome check --write",
    "format:check": "biome check"
  }
}
```

`biome.json` (after `npx @biomejs/biome init`):

```json
{
  "$schema": "https://biomejs.dev/schemas/latest/schema.json",
  "linter": { "enabled": false },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single"
    }
  }
}
```

## Step 7: Husky pre-commit

```bash
npx husky init
npm install -D lint-staged
```

Replace `.husky/pre-commit` with:

```sh
npx lint-staged
```

`package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["oxlint --fix", "biome check --write"]
  }
}
```

## Step 8: Source conventions

- Every source file is `.ts` (use `.tsx` when JSX is present). No `.js`, `.mjs`, `.cjs` source.
- `"type": "module"` in each `package.json`.
- `engines.node` set to `>=<current-lts-version>` (not just `>=<major>.0.0`, so pre-LTS releases of that major are excluded).
- Import with `.ts` extensions: `import { x } from './x.ts'`.
- Run scripts directly with Node: `node src/index.ts`.
- For non-erasable syntax (`enum`, parameter properties, namespaces), either rewrite to erasable syntax or install `tsx` and run `node --import=tsx file.ts`; in that case set `erasableSyntaxOnly: false` in `tsconfig.json`.
- Library `exports` generated by `tsdown`; do not hand-write `main`/`module`/`types`.

## Step 9: CI skeleton

`.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<latest-release>
        with:
          persist-credentials: false
      - uses: actions/setup-node@<latest-release>
        with:
          node-version: lts/*
          check-latest: true
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run format:check
      - run: npm run build
```

Resolve the `<latest-release>` tags with `gh api repos/actions/checkout/releases/latest --jq .tag_name` and `gh api repos/actions/setup-node/releases/latest --jq .tag_name`. `node-version: lts/*` with `check-latest: true` always resolves to the latest LTS; do not hardcode a numeric version.

## References

- Node.js releases and LTS: https://nodejs.org/dist/index.json, https://nodejs.org/en/about/previous-releases
- Node.js TypeScript support: https://nodejs.org/api/typescript.html
- Nx TypeScript monorepo: https://nx.dev/technologies/typescript/introduction
- TypeScript documentation: https://www.typescriptlang.org/docs/
- tsdown docs: https://tsdown.dev
- Oxlint quickstart: https://oxc.rs/docs/guide/usage/linter/quickstart.html
- Biome getting started: https://biomejs.dev/guides/getting-started/
- Husky: https://typicode.github.io/husky/
