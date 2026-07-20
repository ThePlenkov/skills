import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

const { values } = parseArgs({
  options: {
    'since-ref': { type: 'string' },
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
  if (values['since-ref']) {
    const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRT', values['since-ref'], '--'], {
      cwd: ROOT,
      encoding: 'utf-8',
    }).trim();
    for (const file of output.split('\n')) {
      if (file && file.startsWith('skills/')) {
        const full = join(ROOT, file);
        try {
          const stats = await stat(full);
          if (stats.isFile()) yield full;
        } catch {
          // ignore missing files
        }
      }
    }
    return;
  }
  yield* walk(ROOT);
}

for await (const path of getFilesToCheck()) {
  const rel = relative(ROOT, path);
  const text = await readFile(path, 'utf8');
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
