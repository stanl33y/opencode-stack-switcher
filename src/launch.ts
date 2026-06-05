import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { CURRENT_FILE } from "./paths.ts";
import type { StackManifest } from "./stacks.ts";

/** Lança o opencode TUI com OPENCODE_CONFIG_DIR apontando p/ a stack resolvida. */
export function launchOpencode(
  manifest: StackManifest,
  resolvedDir: string,
  passthrough: string[],
): Promise<number> {
  mkdirSync(dirname(CURRENT_FILE), { recursive: true });
  writeFileSync(CURRENT_FILE, `${manifest.name}\n${resolvedDir}\n`);

  const env = {
    ...process.env,
    OPENCODE_CONFIG_DIR: resolvedDir,
    ...(manifest.env ?? {}),
  };

  console.log(`\n▶ opencode (stack: ${manifest.name})  OPENCODE_CONFIG_DIR=${resolvedDir}\n`);

  return new Promise((resolve) => {
    const child = spawn("opencode", passthrough, {
      env,
      stdio: "inherit",
      shell: process.platform === "win32", // resolve opencode.cmd no Windows
    });
    child.on("exit", (code) => resolve(code ?? 0));
    child.on("error", (err) => {
      console.error(`Falha ao lançar opencode: ${err.message}`);
      resolve(1);
    });
  });
}
