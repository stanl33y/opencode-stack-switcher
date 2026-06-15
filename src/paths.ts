import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// OCS project root (where stacks/ and resolved/ live)
export const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const STACKS_DIR = join(PROJECT_ROOT, "stacks");
export const RESOLVED_DIR = join(PROJECT_ROOT, "resolved");

// Global opencode config dir on this host (Windows uses ~/.config/opencode,
// confirmed by opencode/oh-my-openagent's getCliConfigDir resolver).
export const OPENCODE_CONFIG_DIR = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, "opencode")
  : join(homedir(), ".config", "opencode");

export const stackManifestPath = (name: string) => join(STACKS_DIR, `${name}.json`);
export const resolvedStackDir = (name: string) => join(RESOLVED_DIR, name);

// File that records the last activated stack (for `ocs current`).
export const CURRENT_FILE = join(RESOLVED_DIR, ".current");
