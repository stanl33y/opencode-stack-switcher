import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BaseConfigMissingError, StackNotFoundError } from "./errors.ts";
import { STACKS_DIR, stackManifestPath } from "./paths.ts";
import { BaseConfigSchema, type StackManifest, StackManifestSchema } from "./schemas.ts";

// Re-export types for backward compatibility
export type { PrelaunchEntry, StackManifest } from "./schemas.ts";

export function listStackNames(): string[] {
  if (!existsSync(STACKS_DIR)) return [];
  return readdirSync(STACKS_DIR)
    .filter((f) => f.endsWith(".json") && f !== "base.json")
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

export function loadStack(name: string): StackManifest {
  const path = stackManifestPath(name);
  if (!existsSync(path)) {
    throw new StackNotFoundError(name, path);
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  // Preserve original behavior: fill in name from parameter if missing
  if (!raw.name) raw.name = name;
  return StackManifestSchema.parse(raw);
}

export function loadBase(): Record<string, unknown> {
  const basePath = join(STACKS_DIR, "base.json");
  if (!existsSync(basePath)) {
    throw new BaseConfigMissingError();
  }
  return BaseConfigSchema.parse(JSON.parse(readFileSync(basePath, "utf8")));
}
