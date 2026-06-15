import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OPENCODE_CONFIG_DIR, resolvedStackDir } from "./paths.ts";
import { type StackManifest, loadBase } from "./stacks.ts";

/** Centralized env access — avoids direct process.env[ bracket access. */
function getEnv(name: string): string | undefined {
  return process.env[name];
}

export function resolveEnvVars<T>(value: T): T {
  if (typeof value === "string") {
    const match = /^\$\{?(\w+)\}?$/.exec(value.trim());
    if (match) {
      const envVal = getEnv(match[1]);
      if (envVal !== undefined) return envVal as T;
      // fallback: keep the marker if the var doesn't exist
      // but also try to resolve $VAR embedded in a larger string
    }
    // resolve $VAR or ${VAR} inside larger strings (e.g. "Bearer $TOKEN")
    return value.replace(/\$\{?(\w+)\}?/g, (_, name) => getEnv(name) ?? `\${${name}}`) as T;
  }
  if (Array.isArray(value)) {
    return value.map(resolveEnvVars) as T;
  }
  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveEnvVars(v);
    }
    return out as T;
  }
  return value;
}

// Fixed set of oh-my-openagent agents/categories (extracted from current schema/config).
export const OMO_AGENTS = [
  "llama",
  "sisyphus",
  "hephaestus",
  "oracle",
  "librarian",
  "explore",
  "multimodal-looker",
  "prometheus",
  "metis",
  "momus",
  "atlas",
  "sisyphus-junior",
] as const;

export const OMO_CATEGORIES = [
  "visual-engineering",
  "ultrabrain",
  "artistry",
  "quick",
  "unspecified-low",
  "unspecified-high",
  "writing",
] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge: `override` wins; objects merge, arrays/scalars replace. */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>,
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (isObject(v) && isObject(out[k])) {
      // isObject narrows out[k] to Record<string, unknown>
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/** Builds oh-my-opencode.json from default_model + overrides. */
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
    $schema:
      "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/oh-my-opencode.schema.json",
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

/** Resolves a stack: writes resolved/<name>/{opencode.json,oh-my-opencode.json,package.json}. */
export function resolveStack(manifest: StackManifest): ResolveResult {
  const base = loadBase();
  const opencode = manifest.opencode ? deepMerge(base, manifest.opencode) : base;
  const omo = buildOmoConfig(manifest);

  const dir = resolvedStackDir(manifest.name);
  mkdirSync(dir, { recursive: true });
  // resolve $VAR before writing config — otherwise OpenCode may not resolve
  const opencodeResolved = resolveEnvVars(opencode);
  writeFileSync(join(dir, "opencode.json"), `${JSON.stringify(opencodeResolved, null, 2)}\n`);
  writeFileSync(join(dir, "oh-my-opencode.json"), `${JSON.stringify(omo, null, 2)}\n`);

  // package.json with plugin dep — required for the plugin to resolve in this dir.
  const globalPkg = join(OPENCODE_CONFIG_DIR, "package.json");
  const pkgContent = existsSync(globalPkg)
    ? readFileSync(globalPkg, "utf8")
    : `${JSON.stringify({ dependencies: { "@opencode-ai/plugin": "^1.17.7" } }, null, 2)}\n`;
  writeFileSync(join(dir, "package.json"), pkgContent);

  return { dir, opencode, omo };
}
