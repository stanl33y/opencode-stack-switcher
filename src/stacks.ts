import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BaseConfigMissingError, StackNotFoundError } from "./errors.ts";
import { STACKS_DIR, stackManifestPath } from "./paths.ts";
import { BaseConfigSchema, type StackManifest, StackManifestSchema } from "./schemas.ts";

// Re-export types for backward compatibility
export type { PrelaunchEntry, StackManifest } from "./schemas.ts";

/**
 * Lists all stack names found in the stacks/ directory (excluding base.json).
 *
 * @returns Sorted array of stack names (without .json extension)
 */
export function listStackNames(): string[] {
  if (!existsSync(STACKS_DIR)) return [];
  return readdirSync(STACKS_DIR)
    .filter((f) => f.endsWith(".json") && f !== "base.json")
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

/**
 * Loads and validates a stack manifest by name.
 *
 * @param name - Stack name (corresponds to stacks/<name>.json)
 * @returns Parsed and validated StackManifest
 * @throws {StackNotFoundError} When the stack manifest file does not exist
 *
 * @example
 * ```typescript
 * const manifest = loadStack("my-stack");
 * console.log(manifest.description);
 * ```
 */
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

/**
 * Loads and validates the base configuration overlay from stacks/base.json.
 *
 * @returns Parsed base config as a key-value record
 * @throws {BaseConfigMissingError} When stacks/base.json does not exist
 */
export function loadBase(): Record<string, unknown> {
  const basePath = join(STACKS_DIR, "base.json");
  if (!existsSync(basePath)) {
    throw new BaseConfigMissingError();
  }
  return BaseConfigSchema.parse(JSON.parse(readFileSync(basePath, "utf8")));
}
