#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { API_KEY_NAMES, getDefaultEditor, isApiKeySet } from "./config.ts";
import { createResolvedDiff } from "./diff.ts";
import { OcsError, StackNotFoundError } from "./errors.ts";
import { parseJsonc } from "./jsonc.ts";
import { DefaultSpawner, launchOpencode } from "./launch.ts";
import { currentStack, pickStack } from "./menu.ts";
import { OPENCODE_CONFIG_DIR, STACKS_DIR } from "./paths.ts";
import { runPrelaunch } from "./prelaunch.ts";
import { resolveStack } from "./resolve.ts";
import { listStackNames, loadStack } from "./stacks.ts";
import { validateStack } from "./validate.ts";

const KNOWN_COMMANDS = [
  "use",
  "list",
  "show",
  "current",
  "doctor",
  "edit",
  "validate",
  "diff",
  "init",
  "help",
];

/**
 * Computes the Levenshtein edit distance between two strings.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns Minimum number of single-character edits (insert, delete, substitute) to transform a into b
 */
export function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Finds the closest match to an input string from a list of options using Levenshtein distance.
 *
 * @param input - The string to match against
 * @param options - Candidate strings to compare with
 * @returns The closest option within distance 2, or null if no close match exists
 */
export function suggestClosest(input: string, options: string[]): string | null {
  let best: string | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const opt of options) {
    const dist = levenshtein(input, opt);
    if (dist < bestDist && dist <= 2) {
      best = opt;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Formats an OcsError into a multi-line string with message, hint, and optional suggestion.
 *
 * @param err - The OcsError instance to format
 * @param suggestion - Optional "Did you mean?" suggestion string
 * @returns Formatted error string with Error/Hint/Did you mean/Exit code lines
 */
export function formatOcsError(err: OcsError, suggestion?: string | null): string {
  const lines: string[] = [];
  lines.push(`Error: ${err.message}`);
  lines.push(`Hint: ${err.hint}`);
  if (suggestion) {
    lines.push(`Did you mean: ${suggestion}?`);
  }
  lines.push(`Exit code: ${err.exitCode}`);
  return lines.join("\n");
}

function splitArgs(argv: string[]): { args: string[]; passthrough: string[] } {
  const sep = argv.indexOf("--");
  if (sep === -1) return { args: argv, passthrough: [] };
  return { args: argv.slice(0, sep), passthrough: argv.slice(sep + 1) };
}

async function cmdUse(name: string, passthrough: string[]) {
  const manifest = loadStack(name);
  console.log(`Resolving stack '${name}'…`);
  const { dir } = resolveStack(manifest);

  if (manifest.prelaunch?.length) {
    console.log("Prelaunch (local servers):");
    const down = await runPrelaunch(manifest.prelaunch);
    if (down.length) {
      console.log(`\n⚠ Unavailable: ${down.join(", ")}. Launching opencode anyway.`);
    }
  }

  const code = await launchOpencode(manifest, dir, passthrough, new DefaultSpawner());
  process.exit(code);
}

function cmdList() {
  const names = listStackNames();
  const cur = currentStack();
  if (!names.length) {
    console.log("No stacks found in stacks/.");
    return;
  }
  console.log("Stacks:");
  for (const name of names) {
    let desc = "";
    try {
      desc = loadStack(name).description ?? "";
    } catch {
      desc = "(invalid manifest)";
    }
    const mark = name === cur ? " ◀ current" : "";
    console.log(`  ${name.padEnd(18)} ${desc}${mark}`);
  }
}

function cmdShow(name: string) {
  const manifest = loadStack(name);
  const { opencode, omo, dir } = resolveStack(manifest);
  console.log(`# resolved/${name}  (${dir})\n`);
  console.log("## opencode.json (model/small_model/agent)");
  console.log(
    JSON.stringify(
      { model: opencode.model, small_model: opencode.small_model, agent: opencode.agent },
      null,
      2,
    ),
  );
  console.log("\n## oh-my-opencode.json");
  console.log(JSON.stringify(omo, null, 2));
}

function cmdCurrent() {
  const cur = currentStack();
  console.log(cur ? `Active stack: ${cur}` : "No active stack yet.");
}

async function cmdDoctor() {
  console.log(`Global config dir: ${OPENCODE_CONFIG_DIR}`);
  console.log(
    `base.json: ${existsSync(join(STACKS_DIR, "base.json")) ? "ok" : "MISSING — run 'ocs init'"}`,
  );
  console.log("\nProvider environment variables:");
  for (const k of API_KEY_NAMES) {
    console.log(`  ${k}: ${isApiKeySet(k) ? "set" : "—"}`);
  }
  console.log("\nPrelaunch per stack (health-check):");
  for (const name of listStackNames()) {
    const m = loadStack(name);
    if (!m.prelaunch?.length) continue;
    console.log(`  [${name}]`);
    await runPrelaunch(m.prelaunch);
  }
}

function cmdDiff(stackA: string, stackB: string) {
  try {
    const result = createResolvedDiff(stackA, stackB);
    if (result.diff) {
      console.log(result.diff);
    }
    process.exit(result.exitCode);
  } catch (error) {
    if (error instanceof StackNotFoundError) {
      const suggestion = suggestClosest(
        error.message.match(/'([^']+)'/)?.[1] ?? "",
        listStackNames(),
      );
      console.error(formatOcsError(error, suggestion));
      process.exit(error.exitCode);
    }
    throw error;
  }
}

function cmdEdit(name: string) {
  const path = join(STACKS_DIR, `${name}.json`);
  if (!existsSync(path)) {
    throw new StackNotFoundError(name, path);
  }
  const editor = getDefaultEditor();
  const child = spawn(editor, [path], { stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code) => process.exit(code ?? 0));
}

function cmdValidate(name: string) {
  const manifest = loadStack(name);
  console.log(`Validating stack '${name}'…\n`);

  const result = validateStack(manifest);

  if (result.valid) {
    console.log(`✓ Stack validation passed for '${name}'`);
    if (result.warnings.length > 0) {
      console.log(`\nWarnings (${result.warnings.length}):`);
      for (const warning of result.warnings) {
        const loc = warning.location ? ` [${warning.location}]` : "";
        console.log(`  ⚠ ${warning.message}${loc}`);
      }
    }
    process.exit(0);
  } else {
    console.log(`✗ Stack validation failed for '${name}'`);
    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`);
      for (const error of result.errors) {
        const loc = error.location ? ` [${error.location}]` : "";
        console.log(`  ✗ ${error.message}${loc}`);
      }
    }
    if (result.warnings.length > 0) {
      console.log(`\nWarnings (${result.warnings.length}):`);
      for (const warning of result.warnings) {
        const loc = warning.location ? ` [${warning.location}]` : "";
        console.log(`  ⚠ ${warning.message}${loc}`);
      }
    }
    process.exit(2); // ConfigValidationError exit code
  }
}

/** Generates stacks/base.json from global opencode.json, removing variable overlays. */
function cmdInit() {
  const src = join(OPENCODE_CONFIG_DIR, "opencode.json");
  if (!existsSync(src)) {
    console.error(`Could not find ${src} to generate base.json.`);
    process.exit(1);
  }
  const cfg = parseJsonc<Record<string, unknown>>(readFileSync(src, "utf8"));
  delete cfg.model;
  delete cfg.small_model;
  const out = join(STACKS_DIR, "base.json");
  writeFileSync(out, JSON.stringify(cfg, null, 2) + "\n");
  console.log(
    `base.json generated: ${out}\n(providers/mcp/tools/plugins preserved; model/small_model removed)`,
  );
}

function usage() {
  console.log(`ocs — OpenCode Stack Switcher

  ocs                      interactive menu
  ocs use <stack> [-- ...] resolve, prelaunch and launch opencode (args after -- go to opencode)
  ocs list                 list stacks
  ocs show <stack>         show resolved config
  ocs current              active stack
  ocs doctor               check base/keys/ports
  ocs edit <stack>         open manifest in \$EDITOR
  ocs validate <stack>     validate stack manifest (schema + security checks)
  ocs diff <stack1> <stack2> compare two stacks
  ocs init                 (re)generate stacks/base.json from global config
`);
}

async function main() {
  const { args, passthrough } = splitArgs(process.argv.slice(2));
  const [cmd, arg] = args;

  switch (cmd) {
    case undefined: {
      const picked = await pickStack(listStackNames());
      if (picked) await cmdUse(picked, passthrough);
      break;
    }
    case "use":
      if (!arg) {
        console.error("usage: ocs use <stack>");
        process.exit(1);
      }
      await cmdUse(arg, passthrough);
      break;
    case "list":
      cmdList();
      break;
    case "show":
      if (!arg) {
        console.error("usage: ocs show <stack>");
        process.exit(1);
      }
      cmdShow(arg);
      break;
    case "current":
      cmdCurrent();
      break;
    case "doctor":
      await cmdDoctor();
      break;
    case "edit":
      if (!arg) {
        console.error("usage: ocs edit <stack>");
        process.exit(1);
      }
      cmdEdit(arg);
      break;
    case "validate":
      if (!arg) {
        console.error("usage: ocs validate <stack>");
        process.exit(1);
      }
      cmdValidate(arg);
      break;
    case "diff":
      if (!arg || args.length < 3) {
        console.error("usage: ocs diff <stack1> <stack2>");
        process.exit(1);
      }
      cmdDiff(arg, args[2]);
      break;
    case "init":
      cmdInit();
      break;
    case "help":
    case "-h":
    case "--help":
      usage();
      break;
    default: {
      // shortcut: `ocs <stack>` == `ocs use <stack>`
      if (listStackNames().includes(cmd)) {
        await cmdUse(cmd, passthrough);
        break;
      }
      console.error(`unknown command: ${cmd}`);
      const cmdSuggestion = suggestClosest(cmd, KNOWN_COMMANDS);
      const stackSuggestion = suggestClosest(cmd, listStackNames());
      const suggestion = cmdSuggestion ?? stackSuggestion;
      if (suggestion) {
        console.error(`Did you mean: ${suggestion}?`);
      }
      usage();
      process.exit(1);
    }
  }
}

main().catch((err) => {
  if (err instanceof OcsError) {
    let suggestion: string | null = null;
    if (err instanceof StackNotFoundError) {
      suggestion = suggestClosest(err.message.match(/'([^']+)'/)?.[1] ?? "", listStackNames());
    }
    console.error(formatOcsError(err, suggestion));
    process.exit(err.exitCode);
  }
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
