---
name: nodejs
description: "Default Node.js projects to native TypeScript execution, ESM, and the current LTS runtime. Avoid .cjs/.mjs source files and legacy transpilers."
tier: 2
triggers: [user, model]
allowed-tools:
  - read
  - exec
  - web_search
  - web_get_contents
  - grep
source: theplenkov-ai/skills
---

# nodejs

Node.js runs TypeScript source natively. New Node projects should start with `.ts` files, ESM, and no CJS/MJS ceremony. **Node.js LTS is the minimum supported runtime** — always determine the current LTS from the registry and use it as the baseline.

TypeScript used for type-checking should be the latest stable major supported by the project's toolchain. Tools that consume the TypeScript compiler API (`typescript-eslint`, `vue-tsc`, `svelte-check`, `astro check`, `ts-jest`, `ts-morph`) may lag behind a new TypeScript major, so verify compatibility before upgrading.

## When to use

- Creating or reviewing a Node.js project.
- Writing CLI scripts, libraries, or apps.
- Deciding whether to emit `.cjs`/`.mjs`.

## Defaults

- **Node.js LTS is the minimum.** Determine the current LTS from `https://nodejs.org/dist/index.json`:
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
  Set `engines.node` to `>=<current-lts-version>` (strip the leading `v`). If `engines.node` is below the current LTS, update it and run the test suite.
- **Runtime / CI:** In GitHub Actions use the latest `actions/setup-node` release tag with `node-version: lts/*` and `check-latest: true`. This always resolves to the latest LTS without hardcoding a version. Resolve the action tag from `gh api repos/actions/setup-node/releases/latest --jq .tag_name`.
- **Module system:** Add `"type": "module"` to `package.json`. Source files are `.ts` (use `.tsx` when JSX is present).
- **Native TS execution:** Current Node LTS supports TypeScript type stripping for erasable syntax. Run `.ts` directly: `node src/index.ts`. Verify the exact LTS support at https://nodejs.org/api/typescript.html.
- **Import extensions:** Use `.ts` in relative imports: `import { foo } from './foo.ts'`.
- **Non-erasable syntax:** For `enum`, parameter properties, or runtime `namespace`, either rewrite to erasable syntax or run with `tsx`:
  - `npm install -D tsx` (latest stable)
  - `node --import=tsx file.ts` or `npx tsx file.ts`
  - If using `tsx`, set `erasableSyntaxOnly: false` in `tsconfig.json` (or omit it); otherwise `tsc --noEmit` will reject non-erasable syntax.
- **Type checking:** Use the `typescript` package already installed (`npx tsc --noEmit`).
  - New project: recommend the latest stable TypeScript and Node declarations (`npm install -D typescript @types/node`). Verify with `npm view typescript version` and `npm view @types/node version`.
  - Existing project: stay on the latest **stable** patch/minor of the installed major line (skip `alpha`, `beta`, `rc`, `dev`, `next`).
  - For native Go preview/nightly: install `@typescript/native-preview` and run `npx tsgo`.
  - Before upgrading the TypeScript major, verify the toolchain (typescript-eslint, vue-tsc, svelte-check, astro check, ts-jest, ts-morph) supports it.
- **Libraries:** Build with `tsdown`, not `tsc` emit, so you still type-check with `tsc --noEmit` and bundle with `tsdown`.

## tsconfig.json for native execution

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

- `verbatimModuleSyntax` and `erasableSyntaxOnly` keep code compatible with Node type stripping.
- `rewriteRelativeImportExtensions` lets `tsc` rewrite `.ts` imports to `.js` when emitting.
- `allowImportingTsExtensions` lets `tsc` type-check `.ts` import specifiers.
- If the installed TypeScript major is older than the one that introduced an option (e.g., `erasableSyntaxOnly`, `rewriteRelativeImportExtensions`, `allowImportingTsExtensions`), remove the unsupported options from `tsconfig.json` until you upgrade TypeScript.

## Anti-patterns

- Hardcoding a numeric Node version in CI or `engines.node` without verifying the current LTS.
- Setting `engines.node` below the current LTS major.
- Writing `src/index.js` or `src/index.mjs` for new code.
- Using CommonJS (`require`/`module.exports`) in new source files.
- Using `ts-node` or `babel` to run TypeScript when Node supports it natively.
- Emitting `.cjs`/`.mjs` manually; let `tsdown` do it if the package must support both.
- Forcing the latest TypeScript major onto a project pinned to an older line without asking.

## References

- Node.js releases and LTS: https://nodejs.org/dist/index.json, https://nodejs.org/en/about/previous-releases
- Node.js TypeScript support: https://nodejs.org/api/typescript.html
- Node ESM docs: https://nodejs.org/api/esm.html
- tsx: https://github.com/privatenumber/tsx
