import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..', 'nx-skillspector');

// Externalize: nx devkit + node built-ins + Angular/rxjs transitive deps.
// esbuild doesn't glob `node:*` — list built-ins explicitly.
const external = [
  '@nx/devkit',
  'nx',
  'node:fs',
  'node:path',
  'node:fs/promises',
  'node:child_process',
  'node:url',
  'node:os',
  'node:util',
  'node:stream',
  'node:process',
  '@angular-devkit/*',
  'rxjs',
  'typescript',
];

await build({
  entryPoints: [
    resolve(pkgRoot, 'src/index.ts'),
    resolve(pkgRoot, 'src/executors/scan/executor.ts'),
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outdir: resolve(pkgRoot, 'dist'),
  sourcemap: 'inline',
  resolveExtensions: ['.ts', '.js'],
  external,
  logLevel: 'info',
});
console.log('Built plugin + executor to', resolve(pkgRoot, 'dist'));
