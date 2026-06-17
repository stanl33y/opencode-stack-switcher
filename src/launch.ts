import { type ChildProcess, type SpawnOptions, spawn as defaultSpawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { atomicWrite } from "./atomic-write.ts";
import { CURRENT_FILE } from "./paths.ts";
import type { StackManifest } from "./stacks.ts";

/**
 * Injectable interface for process spawning. Allows DI in tests.
 *
 * @example
 * ```typescript
 * const fakeSpawner: ProcessSpawner = {
 *   spawn: (cmd, args, opts) => fakeChildProcess
 * };
 * ```
 */
export interface ProcessSpawner {
  /**
   * Spawns a child process.
   *
   * @param cmd - Command to execute
   * @param args - Arguments to pass to the command
   * @param opts - Spawn options (env, stdio, etc.)
   * @returns The spawned ChildProcess instance
   */
  spawn(cmd: string, args: string[], opts: SpawnOptions): ChildProcess;
}

/** Default spawner that delegates to node:child_process.spawn. */
export class DefaultSpawner implements ProcessSpawner {
  /**
   * @param cmd - Command to execute
   * @param args - Arguments to pass to the command
   * @param opts - Spawn options
   * @returns Spawned ChildProcess from node:child_process
   */
  spawn(cmd: string, args: string[], opts: SpawnOptions): ChildProcess {
    return defaultSpawn(cmd, args, opts);
  }
}

/**
 * Launches the opencode TUI with OPENCODE_CONFIG_DIR pointing to the resolved stack.
 *
 * Writes the current stack name and resolved dir to .current, spawns opencode as a
 * child process, and handles SIGINT/SIGTERM with graceful shutdown and force-kill fallback.
 *
 * @param manifest - The stack manifest being launched
 * @param resolvedDir - Path to the resolved stack directory
 * @param passthrough - Arguments to forward to the opencode process
 * @param spawner - Injectable process spawner (defaults to DefaultSpawner)
 * @param forceKillTimeoutMs - Milliseconds before force-killing on signal (default 5000)
 * @returns Promise resolving to the opencode exit code (130 for SIGINT, 143 for SIGTERM)
 *
 * @example
 * ```typescript
 * const exitCode = await launchOpencode(manifest, dir, []);
 * process.exit(exitCode);
 * ```
 */
export function launchOpencode(
  manifest: StackManifest,
  resolvedDir: string,
  passthrough: string[],
  spawner: ProcessSpawner = new DefaultSpawner(),
  forceKillTimeoutMs = 5000,
): Promise<number> {
  mkdirSync(dirname(CURRENT_FILE), { recursive: true });
  atomicWrite(CURRENT_FILE, `${manifest.name}\n${resolvedDir}\n`);

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

    let signalReceived: NodeJS.Signals | null = null;
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
        forceKillTimer = null;
      }
    };

    const onSignal = (signal: NodeJS.Signals) => {
      signalReceived = signal;
      child.kill("SIGTERM");
      // Force kill after timeout if child doesn't exit gracefully
      forceKillTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, forceKillTimeoutMs);
    };

    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);

    child.on("exit", (code) => {
      cleanup();
      if (signalReceived === "SIGINT") resolve(130);
      else if (signalReceived === "SIGTERM") resolve(143);
      else resolve(code ?? 0);
    });

    child.on("error", (err) => {
      cleanup();
      console.error(`Failed to launch opencode: ${err.message}`);
      resolve(1);
    });
  });
}
