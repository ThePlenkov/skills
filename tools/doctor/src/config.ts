import { access, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import * as path from "node:path";
import { parse } from "yaml";
import type { DoctorConfig } from "./types.ts";

const CONFIG_NAMES = ["doctor.config.ts", "doctor.config.js", "doctor.config.yaml", "doctor.config.yml", "doctor.config.json"];

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig(configPath?: string, cwd = process.cwd()): Promise<DoctorConfig> {
  let file = configPath;
  if (!file) {
    for (const name of CONFIG_NAMES) {
      const candidate = path.resolve(cwd, name);
      if (await exists(candidate)) {
        file = candidate;
        break;
      }
    }
  }
  if (!file) {
    return {};
  }

  const ext = path.extname(file).toLowerCase();
  if (ext === ".json") {
    return JSON.parse(await readFile(file, "utf8")) as DoctorConfig;
  }
  if (ext === ".yaml" || ext === ".yml") {
    return parse(await readFile(file, "utf8")) as DoctorConfig;
  }
  if (ext === ".ts" || ext === ".js") {
    const mod = await import(pathToFileURL(file).href);
    return (mod.default?.default ?? mod.default ?? mod) as DoctorConfig;
  }
  throw new Error(`Unsupported doctor config format: ${file}`);
}
