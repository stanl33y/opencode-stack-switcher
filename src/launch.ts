import { type ChildProcess, type SpawnOptions, spawn as defaultSpawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CURRENT_FILE } from "./paths.ts";
import type { StackManifest } from "./stacks.ts";

/** Injectable interface for process spawning. Allows DI in tests. */
export interface ProcessSpawner {
  spawn(cmd: string, args: string[], opts: SpawnOptions): ChildProcess;
}

/** Default spawner that delegates to node:child_process.spawn. */
export class DefaultSpawner implements ProcessSpawner {
  spawn(cmd: string, args: string[], opts: SpawnOptions): ChildProcess {
    return defaultSpawn(cmd, args, opts);
  }
}

/** Launches the opencode TUI with OPENCODE_CONFIG_DIR pointing to the resolved stack. */
export function launchOpencode(
  manifest: StackManifest,
  resolvedDir: string,
  passthrough: string[],
  spawner: ProcessSpawner = new DefaultSpawner(),
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
    const child = spawner.spawn("opencode", passthrough, {
      env,
      stdio: "inherit",
      shell: process.platform === "win32", // resolve opencode.cmd on Windows
    });
    child.on("exit", (code) => resolve(code ?? 0));
    child.on("error", (err) => {
      console.error(`Failed to launch opencode: ${err.message}`);
      resolve(1);
    });
  });
}
