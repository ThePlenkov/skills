# Always use the latest supported version for the current stack line

Training data and memory are stale. Before writing code, scaffolding, or adding dependencies:

1. Detect the project's current major version line from the manifest (`package.json` `engines` and `devDependencies`/`dependencies`/`peerDependencies`).
2. Query the registry for the latest **stable** supported version in that line:
   - `npm view <pkg> versions --json` and pick the highest stable version matching the current major (skip `alpha`, `beta`, `rc`, `dev`, `next`).
   - `npm view <pkg> version` if you are creating a new project or the user already approved a major line.
3. For **Node.js**, the current LTS is the minimum. Fetch `https://nodejs.org/dist/index.json`, filter where `lts` is not `false`, sort by version, and use the highest LTS release. Set `engines.node` to `>=<current-lts-version>` (strip the leading `v`) and use `node-version: lts/*` with `check-latest: true` in CI. If `engines.node` is below the current LTS, bump it and run tests.
4. For **new** projects, recommend the latest stable major line for each core dependency (e.g., current Node LTS, latest stable TypeScript, tsdown), but first verify the project's toolchain supports that TypeScript major.
5. For **existing** projects, stay on the latest stable patch/minor of the installed major line. Do **not** force a major upgrade without explicit user approval, except for Node.js when the current `engines.node` is below LTS.
6. Query upstream for the latest CI action tag: prefer `gh api repos/<owner>/<repo>/releases/latest --jq .tag_name` or `https://api.github.com/repos/<owner>/<repo>/releases/latest`. If the action publishes tags but no GitHub Releases, fall back to `gh api repos/<owner>/<repo>/tags --jq '.[0].name'` and pick the latest stable tag.
7. Default to the modern TypeScript/Node stack **when it fits the current line**:
   - Node.js native type stripping with `.ts` source and `"type": "module"`.
   - Node native execution only supports erasable syntax. Use `erasableSyntaxOnly: true` in `tsconfig.json`; for `enum`, parameter properties, or namespaces, use `tsx` and set `erasableSyntaxOnly: false`.
   - The installed `typescript` package (`tsc`) for type-checking; the latest stable TypeScript is recommended for new projects. Verify toolchain support (`typescript-eslint`, `vue-tsc`, `svelte-check`, `astro check`, `ts-jest`, `ts-morph`) before upgrading a major.
   - `tsdown` for building libraries when possible.
   - `oxlint` for linting, `biome` for formatting, `husky` for git hooks, `nx` for monorepos.
8. Pin exact versions in `package.json` (`npm install -D --save-exact <pkg>@<resolved>` or `npm pkg set devDependencies.<pkg>=<resolved>`). Avoid floating ranges (`*`, `latest`, `>=`) in committed manifests.
9. Avoid `.cjs`/`.mjs` source files and legacy toolchains (`ts-node`, `tsup`, `eslint`, `prettier`) unless the user explicitly requires them.
10. Run validation (`npm run typecheck`, `npm run build`, `npm run test`, `npm ls`) after changing versions. Roll back to the latest compatible stable version if peer-dependency or toolchain errors appear.
11. Cite the source of every version or default you commit.

When in doubt, invoke `$modern-stack`, `$nodejs`, `$typescript`, `$tsdown`, or `$bootstrap-ts-repo`.
