import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import type { ProcessSpawner } from "../src/launch.ts";

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Creates a fake ChildProcess that responds to kill() by emitting 'exit'.
 * By default, exits with signal-appropriate code on any kill.
 */
function fakeChildResponsive(exitCodeOnKill = 143): ChildProcess {
  const ee = new EventEmitter() as ChildProcess & { kill: ReturnType<typeof mock> };
  ee.kill = mock((signal?: NodeJS.Signals) => {
    process.nextTick(() => ee.emit("exit", exitCodeOnKill));
    return true;
  });
  return ee;
}

/**
 * Creates a fake ChildProcess that ignores SIGTERM but exits on SIGKILL.
 * Simulates a child that doesn't respond gracefully.
 */
function fakeChildStubborn(): ChildProcess & { kill: ReturnType<typeof mock> } {
  const ee = new EventEmitter() as ChildProcess & { kill: ReturnType<typeof mock> };
  ee.kill = mock((signal?: NodeJS.Signals) => {
    if (signal === "SIGKILL") {
      process.nextTick(() => ee.emit("exit", 137));
    }
    // Ignore SIGTERM - don't emit exit
    return true;
  });
  return ee;
}

/** Recording mock spawner. */
class MockSpawner implements ProcessSpawner {
  calls: { cmd: string; args: string[]; opts: SpawnOptions }[] = [];
  child: ChildProcess;

  constructor(child: ChildProcess) {
    this.child = child;
  }

  spawn(cmd: string, args: string[], opts: SpawnOptions): ChildProcess {
    this.calls.push({ cmd, args, opts });
    return this.child;
  }
}

// ── Mocks for fs ───────────────────────────────────────────────────────────

let mkdirSyncSpy: ReturnType<typeof spyOn>;
let writeFileSyncSpy: ReturnType<typeof spyOn>;
let renameSyncSpy: ReturnType<typeof spyOn>;
let unlinkSyncSpy: ReturnType<typeof spyOn>;
let consoleLogSpy: ReturnType<typeof mock>;

beforeEach(async () => {
  const fsMod = await import("node:fs");
  mkdirSyncSpy = spyOn(fsMod, "mkdirSync").mockImplementation(() => undefined);
  writeFileSyncSpy = spyOn(fsMod, "writeFileSync").mockImplementation(() => undefined);
  renameSyncSpy = spyOn(fsMod, "renameSync").mockImplementation(() => undefined);
  unlinkSyncSpy = spyOn(fsMod, "unlinkSync").mockImplementation(() => undefined);
  consoleLogSpy = mock(() => {});
  console.log = consoleLogSpy;
});

afterEach(() => {
  mkdirSyncSpy.mockRestore();
  writeFileSyncSpy.mockRestore();
  renameSyncSpy.mockRestore();
  unlinkSyncSpy.mockRestore();
  console.log = globalThis.console.log;
  console.error = globalThis.console.error;
});

const manifest = { name: "s", description: "test", opencode: { model: "m", small_model: "s" } };

// ── Tests ──────────────────────────────────────────────────────────────────

describe("launchOpencode signal handling", () => {
  it("SIGINT → kills child with SIGTERM and resolves with exit code 130", async () => {
    const child = fakeChildResponsive(143);
    const spawner = new MockSpawner(child);
    const { launchOpencode } = await import("../src/launch.ts");

    const promise = launchOpencode(manifest, "/d", [], spawner, 5000);

    // Let the spawn + listener attachment complete
    await new Promise((r) => process.nextTick(r));

    // Simulate SIGINT (pass signal name as argument)
    // biome-ignore lint/suspicious/noExplicitAny: process.emit requires specific signal types
    process.emit("SIGINT" as any, "SIGINT");

    const code = await promise;

    expect(code).toBe(130);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("SIGTERM → kills child with SIGTERM and resolves with exit code 143", async () => {
    const child = fakeChildResponsive(143);
    const spawner = new MockSpawner(child);
    const { launchOpencode } = await import("../src/launch.ts");

    const promise = launchOpencode(manifest, "/d", [], spawner, 5000);

    await new Promise((r) => process.nextTick(r));

    // Simulate SIGTERM (pass signal name as argument)
    // biome-ignore lint/suspicious/noExplicitAny: process.emit requires specific signal types
    process.emit("SIGTERM" as any, "SIGTERM");

    const code = await promise;

    expect(code).toBe(143);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("force kills child with SIGKILL after timeout when child ignores SIGTERM", async () => {
    const child = fakeChildStubborn();
    const spawner = new MockSpawner(child);
    const { launchOpencode } = await import("../src/launch.ts");

    // Use a short timeout (50ms) so the test doesn't take 5 seconds
    const promise = launchOpencode(manifest, "/d", [], spawner, 50);

    await new Promise((r) => process.nextTick(r));

    // Simulate SIGTERM (pass signal name as argument)
    // biome-ignore lint/suspicious/noExplicitAny: process.emit requires specific signal types
    process.emit("SIGTERM" as any, "SIGTERM");

    // Child ignored SIGTERM, so kill('SIGTERM') was called but no exit yet
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");

    // Wait for the force-kill timeout to fire
    const code = await promise;

    // After timeout, SIGKILL should have been sent
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    // Stubborn child exits with 137 on SIGKILL, but we resolve with signal-based code
    expect(code).toBe(143);
  });

  it("cleans up signal handlers after normal child exit", async () => {
    const { launchOpencode } = await import("../src/launch.ts");

    // Child that exits on its own (no signal needed)
    const normalChild = new EventEmitter() as ChildProcess;
    const spawner = new MockSpawner(normalChild);

    const sigintBefore = process.listenerCount("SIGINT");
    const sigtermBefore = process.listenerCount("SIGTERM");

    // Schedule exit AFTER import completes, right before calling launchOpencode
    const promise = launchOpencode(manifest, "/d", [], spawner, 5000);
    // Emit exit after listeners are attached (launchOpencode is sync before returning promise)
    process.nextTick(() => normalChild.emit("exit", 0));

    const code = await promise;

    expect(code).toBe(0);
    // Signal listeners should be cleaned up (back to baseline)
    expect(process.listenerCount("SIGINT")).toBe(sigintBefore);
    expect(process.listenerCount("SIGTERM")).toBe(sigtermBefore);
  });

  it("cleans up signal handlers after signal-triggered exit", async () => {
    const child = fakeChildResponsive(143);
    const spawner = new MockSpawner(child);
    const { launchOpencode } = await import("../src/launch.ts");

    const sigintBefore = process.listenerCount("SIGINT");
    const sigtermBefore = process.listenerCount("SIGTERM");

    const promise = launchOpencode(manifest, "/d", [], spawner, 5000);
    await new Promise((r) => process.nextTick(r));

    // biome-ignore lint/suspicious/noExplicitAny: process.emit requires specific signal types
    process.emit("SIGINT" as any, "SIGINT");
    await promise;

    expect(process.listenerCount("SIGINT")).toBe(sigintBefore);
    expect(process.listenerCount("SIGTERM")).toBe(sigtermBefore);
  });

  it("does not override exit code when child exits normally (no signal)", async () => {
    const { launchOpencode } = await import("../src/launch.ts");

    // Child that exits on its own with a specific code
    const normalChild = new EventEmitter() as ChildProcess;
    const normalSpawner = new MockSpawner(normalChild);

    const promise = launchOpencode(manifest, "/d", [], normalSpawner, 5000);
    process.nextTick(() => normalChild.emit("exit", 42));

    const code = await promise;

    expect(code).toBe(42);
  });
});
