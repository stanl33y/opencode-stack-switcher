import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolvedStackDir, OPENCODE_CONFIG_DIR } from "./paths.ts";
import { loadBase, type StackManifest } from "./stacks.ts";

/** Substitui `$VAR` ou `${VAR}` por process.env[VAR] em strings. Percorre objetos/arrays recursivamente. */
export function resolveEnvVars<T>(value: T): T {
  if (typeof value === "string") {
    const match = /^\$\{?(\w+)\}?$/.exec(value.trim());
    if (match) {
      const envVal = process.env[match[1]];
      if (envVal !== undefined) return envVal as T;
      // fallback: mantém o marcador se a var não existir
      // mas tenta resolver $VAR embutido em string maior também
    }
    // resolve $VAR ou ${VAR} dentro de strings maiores (ex: "Bearer $TOKEN")
    return value.replace(/\$\{?(\w+)\}?/g, (_, name) => process.env[name] ?? `\${${name}}`) as T;
  }
  if (Array.isArray(value)) {
    return value.map(resolveEnvVars) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveEnvVars(v);
    }
    return out as T;
  }
  return value;
}

// Conjunto fixo de agents/categories do oh-my-openagent (extraído do schema/config atual).
export const OMO_AGENTS = [
  "llama", "sisyphus", "hephaestus", "oracle", "librarian", "explore",
  "multimodal-looker", "prometheus", "metis", "momus", "atlas", "sisyphus-junior",
] as const;

export const OMO_CATEGORIES = [
  "visual-engineering", "ultrabrain", "artistry", "quick",
  "unspecified-low", "unspecified-high", "writing",
] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge: `override` vence; objetos mesclam, arrays/escalares substituem. */
export function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (isObject(v) && isObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/** Monta o oh-my-opencode.json a partir do default_model + overrides. */
export function buildOmoConfig(manifest: StackManifest): Record<string, unknown> {
  const omo = manifest.omo ?? {};
  const def = omo.default_model;
  const agents: Record<string, { model: string }> = {};
  const categories: Record<string, { model: string }> = {};

  for (const a of OMO_AGENTS) {
    const model = omo.agents?.[a] ?? def;
    if (model) agents[a] = { model };
  }
  for (const c of OMO_CATEGORIES) {
    const model = omo.categories?.[c] ?? def;
    if (model) categories[c] = { model };
  }

  return {
    $schema: "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/oh-my-opencode.schema.json",
    sisyphus_agent: { replace_plan: false },
    agents,
    categories,
  };
}

export interface ResolveResult {
  dir: string;
  opencode: Record<string, unknown>;
  omo: Record<string, unknown>;
}

/** Resolve a stack: escreve resolved/<name>/{opencode.json,oh-my-opencode.json,package.json}. */
export function resolveStack(manifest: StackManifest): ResolveResult {
  const base = loadBase();
  const opencode = manifest.opencode ? deepMerge(base, manifest.opencode) : base;
  const omo = buildOmoConfig(manifest);

  const dir = resolvedStackDir(manifest.name);
  mkdirSync(dir, { recursive: true });
  // resolve $VAR antes de escrever o config — senão o OpenCode pode não resolver
  const opencodeResolved = resolveEnvVars(opencode);
  writeFileSync(join(dir, "opencode.json"), JSON.stringify(opencodeResolved, null, 2) + "\n");
  writeFileSync(join(dir, "oh-my-opencode.json"), JSON.stringify(omo, null, 2) + "\n");

  // package.json com a dep do plugin — necessário p/ o plugin resolver neste dir.
  const globalPkg = join(OPENCODE_CONFIG_DIR, "package.json");
  const pkgContent = existsSync(globalPkg)
    ? readFileSync(globalPkg, "utf8")
    : JSON.stringify({ dependencies: { "@opencode-ai/plugin": "1.2.15" } }, null, 2) + "\n";
  writeFileSync(join(dir, "package.json"), pkgContent);

  return { dir, opencode, omo };
}
