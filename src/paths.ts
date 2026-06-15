import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Raiz do projeto ocs (onde ficam stacks/ e resolved/)
export const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const STACKS_DIR = join(PROJECT_ROOT, "stacks");
export const RESOLVED_DIR = join(PROJECT_ROOT, "resolved");

// Config dir global do opencode neste host (Windows usa ~/.config/opencode,
// confirmado pelo resolutor getCliConfigDir do opencode/oh-my-openagent).
export const OPENCODE_CONFIG_DIR = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, "opencode")
  : join(homedir(), ".config", "opencode");

export const stackManifestPath = (name: string) => join(STACKS_DIR, `${name}.json`);
export const resolvedStackDir = (name: string) => join(RESOLVED_DIR, name);

// Arquivo que registra a última stack ativada (para `ocs current`).
export const CURRENT_FILE = join(RESOLVED_DIR, ".current");
