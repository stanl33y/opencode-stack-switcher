import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OPENCODE_CONFIG_DIR, resolvedStackDir } from "./paths.ts";
import { type StackManifest, loadBase } from "./stacks.ts";

/** Centralized env access — avoids direct process.env[ bracket access. */
function getEnv(name: string): string | undefined {
  return process.env[name];
}

/**
 * Recursively resolves `$VAR` and `${VAR}` references in a value against environment variables.
 *
 * Walks strings, arrays, and plain objects. Unresolved variables are kept
 * as `${VAR}` markers so they can be identified later.
 *
 * @param value - The value to resolve (string, array, object, or primitive)
 * @returns A copy of the value with all resolvable variable references replaced
 *
 * @example
 * ```typescript
 * process.env.TOKEN = "abc123";
 * resolveEnvVars("Bearer $TOKEN"); // "Bearer abc123"
 * ```
 */
export function resolveEnvVars<T>(value: T): T {
  if (typeof value === "string") {
    const match = /^\$\{?(\w+)\}?$/.exec(value.trim());
    if (match) {
      const envVal = getEnv(match[1]);
      // SAFETY: envVal is string | undefined; T is constrained to the input type at the call site.
      if (envVal !== undefined) return envVal as T;
      // fallback: keep the marker if the var doesn't exist
      // but also try to resolve $VAR embedded in a larger string
    }
    // resolve $VAR or ${VAR} inside larger strings (e.g. "Bearer $TOKEN")
    // SAFETY: replace() returns string; T is the original input type.
    return value.replace(/\$\{?(\w+)\}?/g, (_, name) => getEnv(name) ?? `\${${name}}`) as T;
  }
  if (Array.isArray(value)) {
    // SAFETY: map preserves array structure; T is the original input type.
    return value.map(resolveEnvVars) as T;
  }
  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveEnvVars(v);
    }
    // SAFETY: out mirrors the input object shape; T is the original input type.
    return out as T;
  }
  return value;
}

/** Known oh-my-openagent agent names (used to build omo config). */
export const OMO_AGENTS = [
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
  "build",
  "OpenCode-Builder",
  "plan",
] as const;

/** Known oh-my-openagent category names (used to build omo config). */
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

/**
 * Deep-merges two objects. Override values win; objects merge recursively, arrays and scalars replace.
 *
 * @param base - The base configuration object
 * @param override - The override configuration object (takes precedence)
 * @returns A new merged object with override values taking precedence
 *
 * @example
 * ```typescript
 * deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 } });
 * // { a: 1, b: { c: 2, d: 3 } }
 * ```
 */
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
  // SAFETY: out mirrors the merged shape of base + override; T is the input type.
  return out as T;
}

/**
 * Builds the oh-my-opencode.json configuration from a stack manifest.
 *
 * Fills in agent and category model assignments using the manifest's omo section,
 * falling back to `default_model` where specific overrides are absent.
 *
 * @param manifest - The stack manifest to build config from
 * @returns Complete oh-my-opencode configuration object
 */
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

/** Result of resolving a stack manifest to disk. */
export interface ResolveResult {
  /** Absolute path to the resolved stack directory */
  dir: string;
  /** Resolved opencode configuration (deep-merged with base) */
  opencode: Record<string, unknown>;
  /** Generated oh-my-opencode configuration */
  omo: Record<string, unknown>;
}

/**
 * Resolves a stack manifest: deep-merges with base config, builds omo config,
 * resolves environment variables, and writes the result to disk.
 *
 * Creates `resolved/<name>/` with opencode.json, oh-my-opencode.json, and package.json.
 *
 * @param manifest - The stack manifest to resolve
 * @returns ResolveResult with the output directory and resolved configurations
 *
 * @example
 * ```typescript
 * const manifest = loadStack("my-stack");
 * const { dir, opencode, omo } = resolveStack(manifest);
 * ```
 */
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
