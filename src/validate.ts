import type { EnvVars, PrelaunchEntry, StackManifest } from "./schemas.ts";

/**
 * Validation result from validateStack.
 */
export interface ValidationResult {
  /** Whether the stack is valid (passes all fatal checks) */
  valid: boolean;
  /** Fatal errors that prevent stack usage */
  errors: ValidationError[];
  /** Warnings that don't prevent stack usage but should be reviewed */
  warnings: ValidationWarning[];
}

/**
 * A validation error (fatal).
 */
export interface ValidationError {
  /** Error type for programmatic handling */
  type: "invalid_check_type" | "schema" | "missing_required_field";
  /** Human-readable error message */
  message: string;
  /** Location in the manifest (e.g., "prelaunch[0].check") */
  location?: string;
}

/**
 * A validation warning (non-fatal).
 */
export interface ValidationWarning {
  /** Warning type for programmatic handling */
  type: "unresolved_env" | "shell_injection" | "plugin" | "empty_check";
  /** Human-readable warning message */
  message: string;
  /** Location in the manifest (e.g., "env.API_KEY") */
  location?: string;
}

/**
 * Shell-injection patterns to warn about in prelaunch.start commands.
 */
const SHELL_INJECTION_PATTERNS: ReadonlyArray<{ pattern: RegExp; name: string }> = [
  { pattern: /\|/, name: "pipe (|)" },
  { pattern: /&/, name: "background (&)" },
  { pattern: /;/, name: "command separator (;)" },
  { pattern: /\$\(/, name: "command substitution ($())" },
  { pattern: /`/, name: "backtick (`)" },
];

/**
 * Known OMO agent names (from current oh-my-openagent plugin).
 * Updated based on T0.1 findings (14 agents after schema refresh).
 */
const KNOWN_OMO_AGENTS = new Set([
  "oracle",
  "sisyphus",
  "hephaestus",
  "librarian",
  "explore",
  "prometheus",
  "metis",
  "momus",
  "multimodal-looker",
  "atlas",
  "build",
  "OpenCode-Builder",
  "plan",
  // "llama" was removed in schema refresh
]);

/**
 * Known OMO category names.
 * Note: Schema shows 0 categories, but legacy stacks use these.
 * We warn about unknown categories to signal potential drift.
 */
const KNOWN_OMO_CATEGORIES = new Set([
  "visual-engineering",
  "ultrabrain",
  "artistry",
  "quick",
  "unspecified-low",
  "unspecified-high",
  "writing",
]);

/**
 * Validates a stack manifest.
 *
 * Performs static analysis checks:
 * - Schema validation (already done by loadStack, but we check for required fields)
 * - Env var resolution (warns if $VAR references don't resolve to set env vars)
 * - Prelaunch check types (only tcp and url are allowed)
 * - Shell-injection patterns in prelaunch.start (warns about risky patterns)
 * - Plugin compatibility (warns about unknown agent/category names)
 *
 * @param manifest - The stack manifest to validate
 * @returns Validation result with errors and warnings
 */
export function validateStack(manifest: StackManifest): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Schema validation: required fields (name and description are required by StackManifestSchema)
  if (!manifest.name || typeof manifest.name !== "string") {
    errors.push({
      type: "missing_required_field",
      message: "Stack manifest is missing required 'name' field",
      location: "name",
    });
  }
  if (!manifest.description || typeof manifest.description !== "string") {
    errors.push({
      type: "missing_required_field",
      message: "Stack manifest is missing required 'description' field",
      location: "description",
    });
  }

  // Env var resolution check
  if (manifest.env) {
    const envWarnings = validateEnvVars(manifest.env);
    warnings.push(...envWarnings);
  }

  // Prelaunch validation
  if (manifest.prelaunch) {
    for (let i = 0; i < manifest.prelaunch.length; i++) {
      const entry = manifest.prelaunch[i];
      const prelaunchErrors = validatePrelaunchEntry(entry, i);
      errors.push(...prelaunchErrors.errors);
      warnings.push(...prelaunchErrors.warnings);
    }
  }

  // Plugin compatibility check
  if (manifest.omo) {
    const pluginWarnings = validateOmoConfig(manifest.omo);
    warnings.push(...pluginWarnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates environment variables for unresolved $VAR references.
 *
 * @param env - The env vars object to validate
 * @returns Array of validation warnings
 */
function validateEnvVars(env: EnvVars): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== "string") continue;

    // Match $VAR and ${VAR} patterns
    const varRefs = value.matchAll(/\$(\w+)|\$\{(\w+)\}/g);
    for (const ref of varRefs) {
      const varName = ref[1] || ref[2]; // Either from $VAR or ${VAR}
      if (varName && !(varName in process.env)) {
        warnings.push({
          type: "unresolved_env",
          message: `Environment variable '${varName}' is referenced but not set`,
          location: `env.${key}`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Validates a single prelaunch entry.
 *
 * @param entry - The prelaunch entry to validate
 * @param index - The index in the prelaunch array (for error messages)
 * @returns Object with errors and warnings arrays
 */
function validatePrelaunchEntry(
  entry: PrelaunchEntry,
  index: number,
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const location = `prelaunch[${index}]`;

  const check = entry.check;

  // Warn about empty check (no error, just warning)
  if (Object.keys(check).length === 0) {
    warnings.push({
      type: "empty_check",
      message: `Prelaunch entry '${entry.name}' has empty check configuration`,
      location: `${location}.check`,
    });
    // Don't return - continue to check other aspects like shell injection
  }

  // Check type validation: only tcp and url are allowed (if non-empty)
  // Empty checks are already warned about above, so only error if keys exist but aren't tcp/url
  if (Object.keys(check).length > 0 && !check.tcp && !check.url) {
    errors.push({
      type: "invalid_check_type",
      message: `Invalid check type for prelaunch entry '${entry.name}': must be 'tcp' or 'url'`,
      location: `${location}.check`,
    });
  }

  // Shell-injection pattern check in start command
  if (entry.start) {
    for (const { pattern, name } of SHELL_INJECTION_PATTERNS) {
      if (pattern.test(entry.start)) {
        warnings.push({
          type: "shell_injection",
          message: `Potential shell injection in '${entry.name}': ${name} detected in start command`,
          location: `${location}.start`,
        });
      }
    }
  }

  return { errors, warnings };
}

/**
 * Validates OMO (oh-my-opencode) plugin configuration for compatibility.
 *
 * Uses lenient mode: unknown agents/categories are warnings, not errors.
 * This accommodates schema drift and future plugin versions.
 *
 * @param omo - The OMO config to validate
 * @returns Array of validation warnings
 */
function validateOmoConfig(omo: {
  agents?: Record<string, string>;
  categories?: Record<string, string>;
}): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Check for unknown agent names
  if (omo.agents) {
    for (const agentName of Object.keys(omo.agents)) {
      if (!KNOWN_OMO_AGENTS.has(agentName)) {
        warnings.push({
          type: "plugin",
          message: `Unknown OMO agent '${agentName}' (may not exist in current plugin version)`,
          location: `omo.agents.${agentName}`,
        });
      }
    }
  }

  // Check for unknown category names
  if (omo.categories) {
    for (const categoryName of Object.keys(omo.categories)) {
      if (!KNOWN_OMO_CATEGORIES.has(categoryName)) {
        warnings.push({
          type: "plugin",
          message: `Unknown OMO category '${categoryName}' (may not exist in current plugin version)`,
          location: `omo.categories.${categoryName}`,
        });
      }
    }
  }

  return warnings;
}
