import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const marketplacePath = join(repoRoot, ".claude-plugin", "marketplace.json");
const readmePath = join(repoRoot, "README.md");
const skillsPath = join(repoRoot, "skills");

function layoutBlock(readme: string): string {
  const lines = readme.split(/\r?\n/);
  const layoutIndex = lines.findIndex((line) => /^## Layout\s*$/.test(line));
  if (layoutIndex < 0) {
    throw new Error(`README is missing the "## Layout" section: ${readmePath}`);
  }

  const nextHeadingIndex = lines.findIndex(
    (line, index) => index > layoutIndex && /^##\s+/.test(line),
  );
  const sectionEnd = nextHeadingIndex < 0 ? lines.length : nextHeadingIndex;
  const fenceStart = lines.findIndex(
    (line, index) => index > layoutIndex && index < sectionEnd && line.trimStart().startsWith("```"),
  );
  const fenceEnd = lines.findIndex(
    (line, index) => index > fenceStart && index < sectionEnd && line.trimStart() === "```",
  );
  if (fenceStart < 0 || fenceEnd < 0) {
    throw new Error(`README Layout section is missing a fenced directory block: ${readmePath}`);
  }
  return lines.slice(fenceStart + 1, fenceEnd).join("\n");
}

function documentedCategories(readme: string): Set<string> {
  const categories = new Set<string>();
  for (const line of layoutBlock(readme).split("\n")) {
    const marker = line.startsWith("├── ") ? "├── " : line.startsWith("└── ") ? "└── " : "";
    if (marker.length === 0) {
      continue;
    }

    const entry = line.slice(marker.length);
    const slash = entry.indexOf("/");
    if (slash > 0) {
      categories.add(entry.slice(0, slash));
    }
  }
  return categories;
}

function documentedPlugins(readme: string): Set<string> {
  const prefix = "**Available plugins:**";
  const line = readme.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  if (!line) {
    throw new Error(`README is missing the "Available plugins" line: ${readmePath}`);
  }

  return new Set(
    line
      .slice(prefix.length)
      .split(",")
      .map((entry) => {
        const trimmed = entry.trim();
        const opening = trimmed.indexOf("`");
        const closing = trimmed.indexOf("`", opening + 1);
        if (opening < 0 || closing < 0) {
          throw new Error(`README has an invalid Available plugins entry: ${trimmed}`);
        }
        return trimmed.slice(opening + 1, closing);
      }),
  );
}

function marketplacePlugins(): Set<string> {
  const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8")) as {
    plugins?: Array<{ name?: unknown }>;
  };
  const plugins = marketplace.plugins ?? [];
  if (plugins.some((plugin) => typeof plugin.name !== "string" || plugin.name.length === 0)) {
    throw new Error(`Marketplace contains a plugin without a valid name: ${marketplacePath}`);
  }
  return new Set(["skills", ...plugins.map((plugin) => plugin.name as string)]);
}

function actualCategories(): Set<string> {
  return new Set(
    readdirSync(skillsPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
}

function difference(left: Set<string>, right: Set<string>): string[] {
  return [...left]
    .filter((value) => !right.has(value))
    .sort((leftValue, rightValue) => leftValue.localeCompare(rightValue));
}

const documented = documentedCategories(readFileSync(readmePath, "utf8"));
const actual = actualCategories();
const missing = difference(actual, documented);
const stale = difference(documented, actual);
const readmePlugins = documentedPlugins(readFileSync(readmePath, "utf8"));
const expectedPlugins = marketplacePlugins();
const missingPlugins = difference(expectedPlugins, readmePlugins);
const stalePlugins = difference(readmePlugins, expectedPlugins);
const marketplaceCategories = new Set([...expectedPlugins].filter((plugin) => plugin !== "skills"));
const missingMarketplaceCategories = difference(actual, marketplaceCategories);
const staleMarketplaceCategories = difference(marketplaceCategories, actual);

if (missing.length > 0 || stale.length > 0) {
  console.error("README skill categories are out of sync with skills/:");
  if (missing.length > 0) {
    console.error(`  Missing from README: ${missing.join(", ")}`);
  }
  if (stale.length > 0) {
    console.error(`  Not present under skills/: ${stale.join(", ")}`);
  }
}

if (missingPlugins.length > 0 || stalePlugins.length > 0) {
  console.error("README Available plugins are out of sync with .claude-plugin/marketplace.json:");
  if (missingPlugins.length > 0) {
    console.error(`  Missing from README: ${missingPlugins.join(", ")}`);
  }
  if (stalePlugins.length > 0) {
    console.error(`  Not present in marketplace: ${stalePlugins.join(", ")}`);
  }
}

if (missingMarketplaceCategories.length > 0 || staleMarketplaceCategories.length > 0) {
  console.error("Marketplace plugins are out of sync with skills/ categories:");
  if (missingMarketplaceCategories.length > 0) {
    console.error(`  Missing plugin entries: ${missingMarketplaceCategories.join(", ")}`);
  }
  if (staleMarketplaceCategories.length > 0) {
    console.error(`  Plugins without categories: ${staleMarketplaceCategories.join(", ")}`);
  }
}

if (
  missing.length > 0 ||
  stale.length > 0 ||
  missingPlugins.length > 0 ||
  stalePlugins.length > 0 ||
  missingMarketplaceCategories.length > 0 ||
  staleMarketplaceCategories.length > 0
) {
  process.exit(1);
}

console.log(
  `README skill categories and available plugins are in sync (${actual.size} categories, ${expectedPlugins.size} plugins).`,
);
