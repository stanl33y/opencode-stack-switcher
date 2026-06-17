import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** OCS project root directory (where stacks/ and resolved/ live). */
export const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Path to the stacks/ directory containing stack manifests. */
export const STACKS_DIR = join(PROJECT_ROOT, "stacks");

/** Path to the resolved/ directory containing resolved stack configs. */
export const RESOLVED_DIR = join(PROJECT_ROOT, "resolved");

/**
 * Global OpenCode config directory on this host.
 * Uses XDG_CONFIG_HOME if set, otherwise ~/.config/opencode.
 * On Windows this resolves to ~/.config/opencode (non-standard but matches OpenCode behavior).
 */
export const OPENCODE_CONFIG_DIR = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, "opencode")
  : join(homedir(), ".config", "opencode");

/**
 * Returns the file path for a stack manifest by name.
 *
 * @param name - Stack name (without .json extension)
 * @returns Absolute path to stacks/<name>.json
 */
export const stackManifestPath = (name: string) => join(STACKS_DIR, `${name}.json`);

/**
 * Returns the directory path for a resolved stack by name.
 *
 * @param name - Stack name
 * @returns Absolute path to resolved/<name>/
 */
export const resolvedStackDir = (name: string) => join(RESOLVED_DIR, name);

/** File that records the last activated stack name and resolved dir (for `ocs current`). */
export const CURRENT_FILE = join(RESOLVED_DIR, ".current");
