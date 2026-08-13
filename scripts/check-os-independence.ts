import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { baselinePathForStatus, isFrontmatterOnlyChange } from './lib/frontmatter-diff.ts';

// Canonicalize ROOT so the symlink-containment check compares realpath against
// realpath (a symlinked checkout would otherwise make every file look external).
const ROOT = realpathSync(resolve(fileURLToPath(import.meta.url), '..', '..'));

const { values } = parseArgs({
  options: {
    'since-ref': { type: 'string' },
    'skill': { type: 'string' },
  },
  allowPositionals: false,
});

// Patterns that are not portable to Windows without Git Bash / WSL / translation.
const POSIX_PATTERNS = [
  { token: 'mkdir -p', advice: 'use file tools or a cross-platform mkdir wrapper' },
  { token: 'cat >', advice: 'use file tools or a write operation' },
  { token: 'cat <<', advice: 'use file tools or a write operation' },
  { token: 'chmod ', advice: 'permissions are handled differently on Windows' },
  { token: 'ln -s', advice: 'symlinks require elevated privileges on Windows' },
  { token: 'rm -rf', advice: 'use file removal tools or a cross-platform wrapper' },
  { token: 'cp -r', advice: 'use file tools or a cross-platform wrapper' },
  { token: 'xargs', advice: 'use a loop or a Node/Python script' },
  { token: 'find ', advice: 'use Node/Python or built-in tools' },
  { token: 'awk ', advice: 'use Node/Python for parsing' },
  { token: 'sed ', advice: 'use edit/file tools or a Node/Python script' },
  { token: 'grep ', advice: 'use search tools or a Node/Python script' },
  { token: 'tail ', advice: 'capture output and inspect it, or use a script' },
  { token: 'head ', advice: 'capture output and inspect it, or use a script' },
  { token: 'tee ', advice: 'redirect output manually or use a script' },
  { token: 'mktemp', advice: 'use the repo tmp/ directory or a Node/Python script' },
  { token: '2>/dev/null', advice: 'avoid POSIX-only stderr redirect in cross-platform examples' }, // NOSONAR S5443
  { token: '2>&1', advice: 'avoid POSIX-only stderr redirect in cross-platform examples' },
  { token: '/tmp/', advice: 'use repo tmp/ or a cross-platform temp helper' }, // NOSONAR S5443
  { token: '/dev/null', advice: 'avoid Unix-only sink' }, // NOSONAR S5443
  { token: '/usr/bin/', advice: 'avoid hardcoded Unix paths' }, // NOSONAR S5443
  { token: '/bin/', advice: 'avoid hardcoded Unix paths' }, // NOSONAR S5443
  { token: '&&', advice: 'split into separate commands or use a script' },
];

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      yield* walk(path);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield path;
    }
  }
}

interface Issue {
  file: string;
  line: number;
  token: string;
  advice: string;
}

const issues: Issue[] = [];

async function* getFilesToCheck(): AsyncGenerator<string> {
  const sinceRef = values['since-ref'];
  const skillDir = values['skill'];
  if (skillDir) {
    // Single-skill mode: check all .md files in the skill directory
    yield* walk(resolve(ROOT, skillDir));
    return;
  }
  if (sinceRef) {
    // Reject refs that git would parse as an option (e.g. `--upload-pack=...`),
    // since the ref is passed positionally before `--` at both diff call sites.
    if (sinceRef.startsWith('-')) {
      throw new Error(`invalid --since-ref '${sinceRef}': must not start with '-'`);
    }
    // `-z` yields NUL-terminated fields with literal (unquoted) pathnames.
    // Each record is `status NUL path NUL`; renames/copies add a second path:
    // `status NUL oldPath NUL newPath NUL`.
    const output = execFileSync('git', ['diff', '--name-status', '-z', '--diff-filter=ACMRT', sinceRef, '--'], {
      cwd: ROOT,
      encoding: 'utf-8',
    });
    const fields = output.split('\0');
    let i = 0;
    while (i < fields.length) {
      const status = fields[i];
      i += 1;
      if (!status) continue;
      const isRenameOrCopy = status[0] === 'R' || status[0] === 'C';
      const oldPath = isRenameOrCopy ? fields[i++] : undefined;
      const file = fields[i++];
      if (!file || !file.startsWith('skills/')) continue;
      const full = join(ROOT, file);
      try {
        const stats = await stat(full);
        if (!stats.isFile()) continue;
        // Reject files that resolve (through symlinks) outside the repo so the
        // scanner never reads content beyond ROOT.
        const real = await realpath(full);
        if (real !== ROOT && !real.startsWith(ROOT + sep)) continue;
      } catch (err) {
        // Only skip genuinely missing files; let other errors surface so a
        // skipped scan is never silent.
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw err;
      }
      // A metadata-only change (e.g. bumping the `source:` frontmatter field)
      // must not force cleaning unrelated pre-existing POSIX patterns in the
      // body. Skip only when the body (everything after the frontmatter) is
      // unchanged from the baseline. A baseline exists only for true
      // modifications (`M`/`T`, baseline is the file itself at `sinceRef`) and
      // for renames within `skills/` (`R`, baseline is the pre-rename path).
      // Additions (`A`), copies (`C`), and moves from outside `skills/` have
      // no in-tree baseline, so their bodies are scanned fully. `git show`
      // errors on a file that must exist at the baseline are real and propagate.
      const baselinePath = baselinePathForStatus(status, file, oldPath);
      if (baselinePath) {
        const baselineText = execFileSync('git', ['show', `${sinceRef}:${baselinePath}`], {
          cwd: ROOT,
          encoding: 'utf-8',
        });
        const newText = await readFile(full, 'utf8');
        if (isFrontmatterOnlyChange(baselineText, newText)) continue;
      }
      yield full;
    }
    return;
  }
  yield* walk(ROOT);
}

// Per-file exemption list. The check is meant for SKILL.md bodies
// (loaded as agent context, where cross-platform portability matters
// for the agent's runtime). A markdown file can also be exempted
// in-place by placing an HTML comment near the top:
//
//   <!-- os-independence-exempt: reason -->
//
// Use this for references/ files that are explicitly "copy these bash
// commands" recipes (e.g. per-environment runs for /evidence). Their
// purpose is to show what to type in the user's terminal, which is
// bash-by-design, but the exemption must be visible in the file itself
// and should note the Windows-compatible runner (Git Bash / WSL).
//
// Add a path here only for legacy files that cannot carry the marker.
// Keep this list short; every entry should be a deliberate call.
const EXEMPT_FILES = new Set<string>([]);

function hasOsIndependenceExemption(text: string): boolean {
  // Look at the first 20 lines only so the marker is deliberate and
  // near the top of the file, not an incidental comment later.
  const head = text.split('\n').slice(0, 20).join('\n');
  return /^[ \t]*<!--[ \t]*os-independence-exempt:[ \t]*[^>\r\n]+-->[ \t]*$/im.test(head);
}

for await (const path of getFilesToCheck()) {
  const text = await readFile(path, 'utf8');
  // Normalize to POSIX-style separators so the EXEMPT_FILES lookup
  // works on every platform. `relative()` on Windows uses
  // backslashes, but the exempt paths above are written with
  // forward slashes — a raw compare would never match there.
  const rel = relative(ROOT, path).replace(/\\/g, '/');
  if (EXEMPT_FILES.has(rel) || hasOsIndependenceExemption(text)) {
    continue; // see EXEMPT_FILES / marker comment above
  }
  const lines = text.split('\n');

  let inShell = false;
  for (let i = 0; i < lines.length; i+=1) {
    const line = lines[i];
    if (/^```(bash|sh|shell)\b/.test(line)) {
      inShell = true;
      continue;
    }
    if (inShell && line.startsWith('```')) {
      inShell = false;
      continue;
    }
    if (inShell) {
      for (const { token, advice } of POSIX_PATTERNS) {
        if (tokenMatches(line, token) && !isGitSubcommand(line, token)) {
          issues.push({ file: rel, line: i + 1, token, advice });
        }
      }
    }
  }
}

if (issues.length === 0) {
  console.log('No POSIX-only shell patterns found in markdown skills.');
  process.exit(0);
}

function isGitSubcommand(line: string, token: string): boolean {
  // `git grep`, `git diff --grep`, etc. are cross-platform because Git ships them on Windows too.
  if (token === 'grep ') {
    return line.includes('git grep');
  }
  return false;
}

function tokenMatches(line: string, token: string): boolean {
  // Use a word boundary for command tokens so "head" does not match "ahead".
  if (/^\w/.test(token)) {
    return new RegExp(`\\b${escapeRegExp(token)}`).test(line);
  }
  return line.includes(token);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Remove overlapping token hits on the same line (e.g. `/usr/bin/` also matches `/bin/`).
const deduped = dedupeIssues(issues);

// Group by file for readability.
const byFile = new Map<string, Issue[]>();
for (const issue of deduped) {
  if (!byFile.has(issue.file)) byFile.set(issue.file, []);
  byFile.get(issue.file)!.push(issue);
}

function dedupeIssues(all: Issue[]): Issue[] {
  const byFileLine = new Map<string, Issue[]>();
  for (const issue of all) {
    const key = `${issue.file}:${issue.line}`;
    if (!byFileLine.has(key)) byFileLine.set(key, []);
    byFileLine.get(key)!.push(issue);
  }

  const result: Issue[] = [];
  for (const group of byFileLine.values()) {
    // Sort by token length descending so longer subsuming patterns are checked first.
    const sorted = group.sort((a, b) => b.token.length - a.token.length);
    const kept: Issue[] = [];
    for (const issue of sorted) {
      if (!kept.some((k) => k.token.includes(issue.token))) {
        kept.push(issue);
      }
    }
    result.push(...kept);
  }
  return result;
}

for (const [file, fileIssues] of byFile) {
  console.log(`\n${file}`);
  for (const issue of fileIssues) {
    console.log(`  line ${issue.line}: "${issue.token}" — ${issue.advice}`);
  }
}

console.log(`\nTotal POSIX-only patterns found: ${deduped.length}`);
process.exit(deduped.length > 0 ? 1 : 0);
