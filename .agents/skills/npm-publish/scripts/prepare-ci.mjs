#!/usr/bin/env node
/**
 * npm-publish prepare-ci
 *
 * Prepares a project for CI/CD publishing via npm trusted publishers.
 * THIS SCRIPT DOES NOT PUBLISH YOUR REAL CODE.
 * It only creates empty 0.0.0 placeholder packages on the npm registry so that
 * `npm trust` can be configured. Your actual release happens later from CI/CD.
 *
 * Requirements:
 *   - npm CLI >= 11.10.0  (`npm install -g npm@^11.10.0`)
 *   - Node.js >= 22.14.0
 *   - 2FA enabled on your npm account
 *   - You must be logged in: `npm login`
 *
 * Usage:
 *   node prepare-ci.mjs [--workflow <filename>] [--dry-run]
 */

import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { glob } from "node:fs/promises";

// ── helpers ──────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const WORKFLOW_FLAG = process.argv.indexOf("--workflow");
const WORKFLOW_FILE = WORKFLOW_FLAG !== -1 ? process.argv[WORKFLOW_FLAG + 1] : null;

function run(cmd, { cwd, silent } = {}) {
  if (DRY_RUN) {
    console.log(`[dry-run] ${cmd}`);
    return "";
  }
  const result = spawnSync(cmd, { shell: true, cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Command failed: ${cmd}\n${result.stderr}`);
  return result.stdout.trim();
}

function tryRun(cmd, { cwd } = {}) {
  const result = spawnSync(cmd, { shell: true, cwd, encoding: "utf8" });
  return { ok: result.status === 0, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function log(msg) { console.log(msg); }
function warn(msg) { console.warn(`⚠️  ${msg}`); }
function step(msg) { console.log(`\n▶ ${msg}`); }

// ── 1. detect CI provider from git remote ────────────────────────────────────

step("Detecting CI/CD provider from git remote...");
const remoteUrl = tryRun("git remote get-url origin").stdout;

let provider, workflowTemplate, defaultWorkflowFile;

if (remoteUrl.includes("github.com")) {
  provider = "github";
  defaultWorkflowFile = "publish.yml";
  log("  → GitHub Actions");
} else if (remoteUrl.includes("gitlab.com")) {
  provider = "gitlab";
  defaultWorkflowFile = ".gitlab-ci.yml";
  log("  → GitLab CI/CD");
} else {
  warn(`Could not detect provider from remote: ${remoteUrl || "(none)"}`);
  warn("Supported: github.com, gitlab.com. Set --workflow manually and configure trust by hand.");
  process.exit(1);
}

const workflowFile = WORKFLOW_FILE || defaultWorkflowFile;

// parse owner/repo from remote URL
const repoMatch = remoteUrl.match(/[:/]([^/]+\/[^/.]+?)(\.git)?$/);
const ownerRepo = repoMatch ? repoMatch[1] : null;
if (!ownerRepo) { warn(`Could not parse owner/repo from: ${remoteUrl}`); process.exit(1); }
log(`  → Repository: ${ownerRepo}`);

// ── 2. find publishable packages ─────────────────────────────────────────────

step("Finding publishable packages...");

const cwd = process.cwd();
const pkgJsonPaths = [];

for await (const f of glob("**/package.json", {
  cwd,
  ignore: ["**/node_modules/**", "**/.git/**"],
})) {
  pkgJsonPaths.push(resolve(cwd, f));
}

const publishable = [];
for (const pkgPath of pkgJsonPaths) {
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  if (pkg.private || !pkg.name) continue;
  publishable.push({ name: pkg.name, path: pkgPath });
}

if (publishable.length === 0) {
  warn("No publishable packages found (all have \"private\": true or missing name).");
  process.exit(0);
}
log(`  Found ${publishable.length} publishable package(s):`);
publishable.forEach(p => log(`    • ${p.name}`));

// ── 3. check which are not yet published ─────────────────────────────────────

step("Checking registry status...");

const unpublished = [];
const alreadyPublished = [];

for (const pkg of publishable) {
  const { ok } = tryRun(`npm view ${pkg.name} version`);
  if (ok) {
    log(`  ✓ ${pkg.name} — already on registry`);
    alreadyPublished.push(pkg);
  } else {
    log(`  ✗ ${pkg.name} — not on registry`);
    unpublished.push(pkg);
  }
}

// ── 4. publish 0.0.0 placeholders ────────────────────────────────────────────

if (unpublished.length > 0) {
  step("Publishing 0.0.0 placeholders (empty — no real code)...");
  console.log("  ⚠️  THIS IS NOT YOUR REAL RELEASE. These are empty placeholder packages.");
  console.log("  ⚠️  Your actual code will be published later from CI/CD when you push a tag.");

  const tmpBase = join(tmpdir(), `npm-prepare-ci-${Date.now()}`);

  for (const pkg of unpublished) {
    const pkgDir = join(tmpBase, pkg.name.replace(/\//g, "__"));
    mkdirSync(pkgDir, { recursive: true });

    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({
      name: pkg.name,
      version: "0.0.0",
      description: "Placeholder — real package published via CI/CD",
    }, null, 2));

    writeFileSync(join(pkgDir, "README.md"), [
      `# ${pkg.name}`,
      "",
      "This is a placeholder package. The real release is published via CI/CD.",
    ].join("\n"));

    log(`  → Publishing placeholder for ${pkg.name}...`);
    try {
      run("npm publish", { cwd: pkgDir });
      log(`  ✓ ${pkg.name}@0.0.0 published`);
    } catch (err) {
      warn(`Failed to publish placeholder for ${pkg.name}: ${err.message}`);
    }
  }

  rmSync(tmpBase, { recursive: true, force: true });
}

// ── 5. configure trusted publishers ──────────────────────────────────────────

step("Configuring trusted publishers...");

const allPackages = [...unpublished, ...alreadyPublished];

for (let i = 0; i < allPackages.length; i++) {
  const pkg = allPackages[i];
  if (i > 0 && !DRY_RUN) {
    // 2-second sleep between calls to stay within 5-min 2FA skip window
    await new Promise(r => setTimeout(r, 2000));
  }

  let trustCmd;
  if (provider === "github") {
    trustCmd = `npm trust github ${pkg.name} --file ${workflowFile} --repo ${ownerRepo} --yes`;
  } else if (provider === "gitlab") {
    const [namespace, project] = ownerRepo.split("/");
    trustCmd = `npm trust gitlab ${pkg.name} --file ${workflowFile} --namespace ${namespace} --project ${project} --yes`;
  }

  log(`  → ${trustCmd}`);
  try {
    run(trustCmd);
    log(`  ✓ Trust configured for ${pkg.name}`);
  } catch (err) {
    warn(`Failed to configure trust for ${pkg.name}: ${err.message}`);
    warn("  If trust already exists, run: npm trust list ${pkg.name}");
  }
}

// ── 6. generate CI workflow file ─────────────────────────────────────────────

step("Generating CI workflow...");

const GITHUB_WORKFLOW = `name: Publish Package

on:
  push:
    tags:
      - 'v*'

permissions:
  id-token: write
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build --if-present
      - run: npm test
      - run: npm publish
`;

const GITLAB_WORKFLOW = `stages:
  - test
  - publish

test:
  stage: test
  image: node:22
  script:
    - npm ci
    - npm test

publish:
  stage: publish
  image: node:22
  id_tokens:
    NPM_ID_TOKEN:
      aud: "npm:registry.npmjs.org"
    SIGSTORE_ID_TOKEN:
      aud: sigstore
  script:
    - npm ci
    - npm run build --if-present
    - npm publish
  only:
    - tags
`;

let workflowContent, workflowPath;
if (provider === "github") {
  workflowPath = join(cwd, ".github", "workflows", workflowFile);
  workflowContent = GITHUB_WORKFLOW;
} else {
  workflowPath = join(cwd, workflowFile);
  workflowContent = GITLAB_WORKFLOW;
}

if (existsSync(workflowPath)) {
  log(`  ℹ️  Workflow already exists at ${workflowPath} — skipping (not overwriting)`);
} else {
  if (!DRY_RUN) {
    mkdirSync(dirname(workflowPath), { recursive: true });
    writeFileSync(workflowPath, workflowContent);
  }
  log(`  ✓ Created ${workflowPath}`);
}

// ── 7. summary ───────────────────────────────────────────────────────────────

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ prepare-ci complete

Placeholder packages published (0.0.0, empty — NOT your real code):
${unpublished.map(p => `  • ${p.name}@0.0.0`).join("\n") || "  (none — all already existed)"}

Trusted publishers configured:
${allPackages.map(p => `  • ${p.name} → ${provider} / ${ownerRepo} / ${workflowFile}`).join("\n")}

Workflow file: ${workflowPath}

⚠️  No real code has been published.
Next step: push a version tag (e.g. git tag v1.0.0 && git push --tags)
           to trigger the CI workflow and publish your real release.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
