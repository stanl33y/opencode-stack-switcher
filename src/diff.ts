import { resolveStack } from "./resolve.ts";
import type { StackManifest } from "./schemas.ts";

/**
 * Represents a single difference between two stack manifests.
 */
export interface DiffEntry {
  /** Dot-separated path to the differing field (e.g. "omo.agents.oracle") */
  path: string;
  /** Type of difference: "added", "removed", or "changed" */
  type: "added" | "removed" | "changed";
  /** Value in the left manifest (undefined if added) */
  left: unknown;
  /** Value in the right manifest (undefined if removed) */
  right: unknown;
}

/**
 * Result of comparing two stack manifests.
 */
export interface DiffResult {
  /** Whether the two manifests are identical */
  identical: boolean;
  /** List of differences found */
  differences: DiffEntry[];
}

/**
 * Masks API keys in string values to prevent secret leaks.
 * @param value - The value to mask
 * @returns Masked value with secrets replaced
 */
function maskSecrets(value: unknown): unknown {
  if (typeof value !== "string") return value;

  // Mask OpenAI API keys (sk-)
  let masked = value.replace(/sk-[a-zA-Z0-9]{20,}/g, "sk-***");

  // Mask Zai API keys (zai-)
  masked = masked.replace(/zai-[a-zA-Z0-9]{10,}/g, "zai-***");

  // Mask OpenRouter API keys (sk-or-)
  masked = masked.replace(/sk-or-[a-zA-Z0-9]{20,}/g, "or-***");

  return masked;
}

/**
 * Recursively compares two values and collects differences.
 */
function diffValues(left: unknown, right: unknown, path: string, diffs: DiffEntry[]): void {
  // Both undefined/null — identical
  if (left === undefined && right === undefined) return;
  if (left === null && right === null) return;

  // One side missing
  if (left === undefined || left === null) {
    diffs.push({ path, type: "added", left, right });
    return;
  }
  if (right === undefined || right === null) {
    diffs.push({ path, type: "removed", left, right });
    return;
  }

  // Both are objects (but not null)
  if (typeof left === "object" && typeof right === "object") {
    // Handle arrays
    if (Array.isArray(left) && Array.isArray(right)) {
      diffArrays(left, right, path, diffs);
      return;
    }
    // One is array, other is not — treat as changed
    if (Array.isArray(left) !== Array.isArray(right)) {
      diffs.push({ path, type: "changed", left, right });
      return;
    }

    // Both are plain objects — compare keys
    const leftObj = left as Record<string, unknown>;
    const rightObj = right as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj)]);

    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      diffValues(leftObj[key], rightObj[key], childPath, diffs);
    }
    return;
  }

  // Primitive values — compare
  if (left !== right) {
    diffs.push({ path, type: "changed", left, right });
  }
}

/**
 * Compares two arrays element-by-element.
 * For prelaunch arrays, uses name-based matching when available.
 */
function diffArrays(left: unknown[], right: unknown[], path: string, diffs: DiffEntry[]): void {
  // Try name-based matching if elements have name fields
  if (
    left.length > 0 &&
    right.length > 0 &&
    typeof left[0] === "object" &&
    left[0] !== null &&
    "name" in (left[0] as Record<string, unknown>) &&
    typeof right[0] === "object" &&
    right[0] !== null &&
    "name" in (right[0] as Record<string, unknown>)
  ) {
    diffArraysByName(
      left as Record<string, unknown>[],
      right as Record<string, unknown>[],
      path,
      diffs,
    );
    return;
  }

  // Index-based comparison
  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i++) {
    const childPath = `${path}[${i}]`;
    if (i >= left.length) {
      diffs.push({ path: childPath, type: "added", left: undefined, right: right[i] });
    } else if (i >= right.length) {
      diffs.push({ path: childPath, type: "removed", left: left[i], right: undefined });
    } else {
      diffValues(left[i], right[i], childPath, diffs);
    }
  }
}

/**
 * Compares two arrays of named objects (like prelaunch entries).
 */
function diffArraysByName(
  left: Record<string, unknown>[],
  right: Record<string, unknown>[],
  path: string,
  diffs: DiffEntry[],
): void {
  const leftByName = new Map(left.map((item) => [String(item.name), item]));
  const rightByName = new Map(right.map((item) => [String(item.name), item]));

  // Check for removed/changed entries
  for (const [name, leftEntry] of leftByName) {
    const childPath = `${path}[${name}]`;
    if (!rightByName.has(name)) {
      diffs.push({ path: childPath, type: "removed", left: leftEntry, right: undefined });
    } else {
      diffValues(leftEntry, rightByName.get(name), childPath, diffs);
    }
  }

  // Check for added entries
  for (const [name, rightEntry] of rightByName) {
    if (!leftByName.has(name)) {
      const childPath = `${path}[${name}]`;
      diffs.push({ path: childPath, type: "added", left: undefined, right: rightEntry });
    }
  }
}

/**
 * Compares two stack manifests and returns all differences.
 *
 * @param left - The first stack manifest (baseline)
 * @param right - The second stack manifest (comparison target)
 * @returns DiffResult with identical flag and list of differences
 */
export function diffStacks(left: StackManifest, right: StackManifest): DiffResult {
  const differences: DiffEntry[] = [];
  diffValues(left, right, "", differences);
  return {
    identical: differences.length === 0,
    differences,
  };
}

/**
 * Formats a DiffResult into a human-readable string.
 *
 * @param result - The diff result to format
 * @param nameA - Display name for the left (baseline) stack
 * @param nameB - Display name for the right (comparison) stack
 * @returns Formatted string showing all differences, or an "identical" message
 */
export function formatDiff(result: DiffResult, nameA: string, nameB: string): string {
  if (result.identical) {
    return `Stacks '${nameA}' and '${nameB}' are identical.`;
  }

  const lines: string[] = [`Differences between '${nameA}' and '${nameB}':`, ""];

  for (const diff of result.differences) {
    switch (diff.type) {
      case "added":
        lines.push(`  + ${diff.path}: ${formatValue(diff.right)} (added)`);
        break;
      case "removed":
        lines.push(`  - ${diff.path}: ${formatValue(diff.left)} (removed)`);
        break;
      case "changed":
        lines.push(`  ~ ${diff.path}: ${formatValue(diff.left)} → ${formatValue(diff.right)}`);
        break;
    }
  }

  lines.push("");
  lines.push(`${result.differences.length} difference(s) found.`);

  return lines.join("\n");
}

/**
 * Creates a git-style unified diff of resolved stack configurations.
 *
 * Resolves both stacks, compares their opencode and omo configs,
 * and masks any API keys found in the diff output.
 *
 * @param nameA - Name of the first stack (baseline)
 * @param nameB - Name of the second stack (comparison target)
 * @returns Object with exitCode (0 if identical, 1 if different) and diff string
 * @throws {StackNotFoundError} When either stack does not exist
 *
 * @example
 * ```typescript
 * const { exitCode, diff } = createResolvedDiff("dev", "prod");
 * if (diff) console.log(diff);
 * ```
 */
export function createResolvedDiff(
  nameA: string,
  nameB: string,
): { exitCode: number; diff: string } {
  // Import dynamically to avoid circular dependency
  const { loadStack } = require("./stacks.ts");

  const manifestA = loadStack(nameA);
  const manifestB = loadStack(nameB);

  // Resolve both stacks (this applies deep merge with base.json)
  const resolvedA = resolveStack(manifestA);
  const resolvedB = resolveStack(manifestB);

  // Compare the resolved configurations (opencode + omo + env)
  const configA = {
    opencode: resolvedA.opencode,
    omo: resolvedA.omo,
  };
  const configB = {
    opencode: resolvedB.opencode,
    omo: resolvedB.omo,
  };

  const differences: DiffEntry[] = [];
  diffValues(configA, configB, "", differences);

  if (differences.length === 0) {
    return { exitCode: 0, diff: "" };
  }

  // Create git-style diff output
  const lines: string[] = [];
  lines.push(`--- ${nameA} (resolved)`);
  lines.push(`+++ ${nameB} (resolved)`);

  for (const diff of differences) {
    const leftStr = maskSecrets(formatValue(diff.left));
    const rightStr = maskSecrets(formatValue(diff.right));

    switch (diff.type) {
      case "added":
        lines.push(`+ ${diff.path}: ${rightStr}`);
        break;
      case "removed":
        lines.push(`- ${diff.path}: ${leftStr}`);
        break;
      case "changed":
        lines.push(`- ${diff.path}: ${leftStr}`);
        lines.push(`+ ${diff.path}: ${rightStr}`);
        break;
    }
  }

  return { exitCode: 1, diff: lines.join("\n") };
}

function formatValue(value: unknown): string {
  if (value === undefined) return "(none)";
  if (value === null) return "(null)";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
