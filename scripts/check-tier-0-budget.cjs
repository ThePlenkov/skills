const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const repoRoot = process.argv[2] || path.resolve(__dirname, '..');

const { skillMetadata } = require(path.join(repoRoot, 'skills.config.ts'));

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      yield full;
    }
  }
}

function extractFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) return null;
  const end = content.indexOf('\n---', 4);
  if (end === -1) return null;
  return content.slice(4, end).replace(/\r\n/g, '\n');
}

function getTier(frontmatter, name) {
  const config = skillMetadata[name];
  const configMeta =
    config?.frontmatter?.metadata && typeof config.frontmatter.metadata === 'object' && !Array.isArray(config.frontmatter.metadata)
      ? config.frontmatter.metadata
      : {};
  const currentMeta =
    frontmatter.metadata && typeof frontmatter.metadata === 'object' && !Array.isArray(frontmatter.metadata)
      ? frontmatter.metadata
      : {};
  return configMeta.tier ?? currentMeta.tier ?? frontmatter.tier;
}

let total = 0;
const files = [];
for (const skillPath of walk(path.join(repoRoot, 'skills'))) {
  const frontmatterText = extractFrontmatter(skillPath);
  if (!frontmatterText) continue;
  let data;
  try {
    data = YAML.parse(frontmatterText);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    process.stderr.write(`::error::failed to parse YAML frontmatter in ${skillPath}: ${message}\n`);
    process.exit(1);
  }
  const name = data?.name ?? '';
  if (!name) {
    process.stderr.write(`::error::SKILL.md at ${skillPath} is missing a name\n`);
    process.exit(1);
  }
  if (!skillMetadata[name]) {
    process.stderr.write(`::error::Skill '${name}' is missing a skills.config.ts entry (file: ${skillPath})\n`);
    process.exit(1);
  }
  const tier = getTier(data, name);
  if (tier === 0 || (typeof tier === 'string' && tier.trim() === '0')) {
    const lines = fs.readFileSync(skillPath, 'utf8').trimEnd().split(/\r?\n/).length;
    files.push({ path: skillPath, lines });
    total += lines;
  }
}

for (const { path: p, lines } of files) {
  console.log(`${lines}  ${p}`);
}
console.log(`Total Tier 0: ${total} lines (must be <= 300)`);

if (total > 300) {
  process.stderr.write(`::error::Tier 0 always-on skills total ${total} lines, exceeding the 300-line budget\n`);
  process.exit(1);
}
