# Measure Dep Cost — Node.js

Concrete commands for measuring a Node.js dependency's cost. Use this reference when running `$skill{dep-cost}` for a Node.js project.

## What to measure

| Metric | Tool | What it tells you |
|---|---|---|
| Install / unpacked size | `npm view <pkg> dist.unpackedSize` | Onboarding pain, CI time, lockfile churn |
| Tarball size | `npm view <pkg> dist.tarball` | Download size (smaller than unpacked) |
| Weekly downloads | `npmjs.com` / `npm view <pkg>` | Trust signal |
| Last publish | `npm view <pkg> time` | Maintenance signal |
| Bundle impact (prod) | `bundlephobia` / `npx cost-of-modules@1.0.1` | What the user actually pays |
| Unused deps | `npx depcheck@1.4.7` | Dead weight in package.json |
| Transitive deps | `npm ls <pkg>` | The real cost (not just the direct dep) |
| Vulnerabilities | `npm audit` | Security cost |

## Install size

```bash
# Latest version's unpacked size
npm view <pkg> dist.unpackedSize
# Tarball (compressed download)
npm view <pkg> dist.tarball
# Last publish (freshness signal)
npm view <pkg> time --json | jq '.modified, .created'
# Weekly downloads
npm view <pkg> --json | jq '.time, .users'  # not exact; better: npmjs.com
```

## Bundle impact

### Option 1: bundlephobia (web)

`https://bundlephobia.com/package/<pkg>` — minified + gzipped size, dependency tree, and a "size over time" graph.

### Option 2: cost-of-modules (CLI)

```bash
npx cost-of-modules@1.0.1
# Output table: package | size | gzip
# Run on a built project (after `npm run build`)
```

### Option 3: source-map-explorer (CLI)

```bash
npm install --save-dev source-map-explorer@2.5.3
npx source-map-explorer@2.5.3 dist/main.*.js
# Visual treemap of what's in the bundle
```

### Option 4: direct measurement (most accurate)

```bash
# Install the dep, build, measure
npm install <pkg>
npm run build
du -sh dist/
# Compare against a build without the dep
```

## Used surface

### What do we actually import from the dep?

```bash
rg "from ['\"]<pkg>" -t ts -t js --no-filename | sort -u
rg "require\(['\"]<pkg>" -t ts -t js --no-filename | sort -u
# For each import path, list the symbols used
rg "from ['\"]<pkg/(\w+)" -t ts -t js --no-filename -r '$1' | sort -u
```

Example: if you only see `from 'lodash/get'` and `from 'lodash/debounce'`, you use 2 of lodash's ~300 functions. Reimplementable.

### Unused deps (whole package)

```bash
npx depcheck
# Lists: unused dependencies, unused devDependencies, missing dependencies
```

## Transitive deps

```bash
# Full tree
npm ls <pkg>
# Just count
npm ls <pkg> --json | jq '.dependencies | keys | length'
# Who depends on this (reverse)
npm ls <pkg> --all
```

A 50KB dep with 30 transitive deps is not 50KB. The transitive cost is the real number.

## Tree-shaking

ESM packages tree-shake; CJS doesn't. Before assuming the dep is "small":

```bash
# Check module type
cat node_modules/<pkg>/package.json | jq '.type, .main, .module, .exports'
# - "module" or "exports" with ESM → tree-shakeable
# - "main" only → CJS, full bundle cost
```

If the dep is CJS-only, the bundle cost equals the package size, not the used surface. This flips the dep-cost decision.

## Common gotchas

1. **devDependencies don't ship to prod.** `bundlephobia` measures prod bundle, not dev. A 500KB devDep is fine.
2. **peerDependencies.** If the dep has peers, you may need to install them too, and they count toward the cost.
3. **Optional dependencies.** Some packages have `optionalDependencies` that may or may not install. Check `npm ls --all`.
4. **ESM vs CJS.** A CJS dep is full-bundle; an ESM dep is tree-shakeable. Always check `package.json` before concluding the dep is small.
5. **Bundle analysis tools lie about dev mode.** Run the analysis on a production build, not `npm run dev`.
6. **Side effects break tree-shaking.** If a package has `"sideEffects": false` (or no sideEffects field but is pure), tree-shaking works. Otherwise, the whole package ships.
7. **TypeScript types only.** `@types/*` packages don't ship to prod. They're free.

## Worked example: is lodash worth it?

```bash
# Step 1: what do we use?
rg "from ['\"]lodash" -t ts --no-filename | sort -u
# → only `from 'lodash/get'` and `from 'lodash/debounce'`

# Step 2: how big is lodash?
npm view lodash dist.unpackedSize
# → 5.4MB unpacked (huge)

# Step 3: tree-shaken?
cat node_modules/lodash/package.json | jq '.type, .main, .module'
# → "main": "lodash.js" only → CJS, no tree-shaking

# Step 4: bundle impact
# Run cost-of-modules or source-map-explorer on production build
# Without lodash: bundle was 200KB
# With lodash: bundle is 280KB
# Real cost: 80KB for 2 functions

# Step 5: reimplement cost
# - `_.get(obj, path, default)` is ~10 LOC
# - `_.debounce(fn, ms)` is ~15 LOC with cancellation
# Total: 25 LOC, trivial

# Decision: reimplement. Remove lodash.
# Document: "Replaced lodash.get and lodash.debounce with local impls in
# src/utils/path.ts and src/utils/timing.ts. Bundle dropped 80KB. No
# feature regression; cancellation behavior is now explicit in our impl."
```

## When to keep the dep anyway

- Used surface > 40% of the dep's API (use depcheck + manual count)
- Dep is security-critical (e.g., `bcrypt`, `jsonwebtoken`) — reimplementation is how you get a CVE
- Dep is industry standard and replacements are worse (`react`, `next`, `typescript`)
- The dep is a devDep and the size is irrelevant
