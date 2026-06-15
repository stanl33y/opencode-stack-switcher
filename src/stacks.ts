import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { STACKS_DIR, stackManifestPath } from "./paths.ts";

export interface PrelaunchEntry {
  name: string;
  /** Porta TCP para health-check (alternativa a `url`). */
  check: { tcp?: number; url?: string };
  /** Comando de shell para subir o servidor. Vazio => só health-check/aviso. */
  start?: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface StackManifest {
  name: string;
  description: string;
  /** Overlay deep-merged em base.json -> opencode.json da stack. */
  opencode?: Record<string, unknown>;
  /** Mapa de modelos do plugin oh-my-openagent. */
  omo?: {
    default_model?: string;
    agents?: Record<string, string>;
    categories?: Record<string, string>;
  };
  prelaunch?: PrelaunchEntry[];
  env?: Record<string, string>;
}

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
    throw new Error(`Stack '${name}' não existe (${path}). Use 'ocs list'.`);
  }
  const manifest = JSON.parse(readFileSync(path, "utf8")) as StackManifest;
  if (!manifest.name) manifest.name = name;
  return manifest;
}

export function loadBase(): Record<string, unknown> {
  const basePath = join(STACKS_DIR, "base.json");
  if (!existsSync(basePath)) {
    throw new Error(`stacks/base.json ausente — rode 'ocs init' para gerá-lo do config atual.`);
  }
  return JSON.parse(readFileSync(basePath, "utf8")) as Record<string, unknown>;
}
