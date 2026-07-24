// Helpers for deciding whether a change to a skill file only touches its YAML
// frontmatter. The OS-independence check scans the whole body of any changed
// skill file, which is correct when the body is edited. But a metadata-only
// change (e.g. bumping the `source:` frontmatter field across many skills)
// should not force cleaning unrelated pre-existing POSIX patterns in the body.
//
// Rather than parse diff hunks, we compare the body (everything after the
// leading frontmatter block) of the baseline and working versions: the change
// is frontmatter-only iff those bodies are identical. This is robust to
// additions, deletions, and delimiter boundaries alike.

/**
 * Return the 1-based line number of the closing `---` of the leading YAML
 * frontmatter block, or 0 if the text has no frontmatter.
 */
export function frontmatterEndLine(text: string): number {
  const lines = text.split('\n');
  if ((lines[0] ?? '').trim() !== '---') return 0;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') return i + 1;
  }
  return 0;
}

/**
 * Return everything after the leading frontmatter block. If the text has no
 * frontmatter, the whole text is the body.
 */
export function bodyAfterFrontmatter(text: string): string {
  const end = frontmatterEndLine(text);
  if (end === 0) return text;
  return text.split('\n').slice(end).join('\n');
}

/**
 * True when the two versions differ only within their leading frontmatter
 * block (their bodies match, ignoring line-ending style).
 */
export function isFrontmatterOnlyChange(oldText: string, newText: string): boolean {
  const normalize = (s: string) => s.replace(/\r\n/g, '\n');
  return normalize(bodyAfterFrontmatter(oldText)) === normalize(bodyAfterFrontmatter(newText));
}

/**
 * Given a `git diff --name-status` entry, return the path whose baseline
 * content provides the "before" side for a frontmatter-only comparison, or
 * `undefined` when the file has no in-tree baseline and must be scanned fully.
 *
 * - `M`/`T` (modified): the file itself at the baseline ref.
 * - `R` (rename) with a source under `skills/`: the pre-rename path.
 * - `A` (added), `C` (copy), and renames/copies from outside `skills/`: no
 *   baseline (scan the destination in full, like a new file).
 */
export function baselinePathForStatus(
  status: string,
  file: string,
  oldPath?: string,
): string | undefined {
  if (status.startsWith('M') || status.startsWith('T')) return file;
  if (status[0] === 'R' && oldPath?.startsWith('skills/')) return oldPath;
  return undefined;
}
