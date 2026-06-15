import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import type { ProcessSpawner } from "../src/launch.ts";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Creates a fake ChildProcess that emits 'exit' with the given code. */
function fakeChild(exitCode: number | null = 0): ChildProcess {
  const ee = new EventEmitter() as ChildProcess;
  // Defer exit so listeners are attached first
  process.nextTick(() => ee.emit("exit", exitCode));
  return ee;
}

/** Creates a fake ChildProcess that emits 'error'. */
function fakeChildError(err: Error): ChildProcess {
  const ee = new EventEmitter() as ChildProcess;
  process.nextTick(() => ee.emit("error", err));
  return ee;
}

/** Recording mock spawner that captures calls and returns configurable children. */
class MockSpawner implements ProcessSpawner {
  calls: { cmd: string; args: string[]; opts: SpawnOptions }[] = [];
  childFactory: (callIndex: number) => ChildProcess;

  constructor(childFactory?: (callIndex: number) => ChildProcess) {
    this.childFactory = childFactory ?? (() => fakeChild(0));
  }

  spawn(cmd: string, args: string[], opts: SpawnOptions): ChildProcess {
    const idx = this.calls.length;
    this.calls.push({ cmd, args, opts });
    return this.childFactory(idx);
  }
}

// ── Mocks for fs ───────────────────────────────────────────────────────────

let mkdirSyncSpy: ReturnType<typeof spyOn>;
let writeFileSyncSpy: ReturnType<typeof spyOn>;
let consoleLogSpy: ReturnType<typeof mock>;
let consoleErrorSpy: ReturnType<typeof mock>;
let logOutput: string[];
let errorOutput: string[];

beforeEach(async () => {
  const fsMod = await import("node:fs");
  mkdirSyncSpy = spyOn(fsMod, "mkdirSync").mockImplementation(() => undefined);
  writeFileSyncSpy = spyOn(fsMod, "writeFileSync").mockImplementation(() => undefined);

  logOutput = [];
  errorOutput = [];
  consoleLogSpy = mock((msg: string) => logOutput.push(msg));
  consoleErrorSpy = mock((msg: string) => errorOutput.push(msg));
  console.log = consoleLogSpy;
  console.error = consoleErrorSpy;
});

afterEach(() => {
  mkdirSyncSpy.mockRestore();
  writeFileSyncSpy.mockRestore();
  console.log = globalThis.console.log;
  console.error = globalThis.console.error;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("launchOpencode", () => {
  // Import after mocks are in place
  it("spawns opencode with correct cmd, args, env, and shell option", async () => {
    const { launchOpencode } = await import("../src/launch.ts");
    const spawner = new MockSpawner(() => fakeChild(0));

    const manifest = {
      name: "test-stack",
      description: "test",
      opencode: { model: "openai:gpt-4o", small_model: "openai:gpt-4o-mini" },
      env: { MY_VAR: "hello" },
    };
    const code = await launchOpencode(manifest, "/fake/resolved", ["--help", "--verbose"], spawner);

    expect(code).toBe(0);
    expect(spawner.calls).toHaveLength(1);

    const { cmd, args, opts } = spawner.calls[0]!;
    expect(cmd).toBe("opencode");
    expect(args).toEqual(["--help", "--verbose"]);
    expect(opts.env).toBeDefined();
    expect(opts.env!.OPENCODE_CONFIG_DIR).toBe("/fake/resolved");
    expect(opts.env!.MY_VAR).toBe("hello");
    expect(opts.stdio).toBe("inherit");
    expect(opts.shell).toBe(process.platform === "win32");
  });

  it("writes CURRENT_FILE with stack name and resolved dir", async () => {
    const { launchOpencode } = await import("../src/launch.ts");
    const spawner = new MockSpawner(() => fakeChild(0));

    const manifest = {
      name: "my-stack",
      description: "test",
      opencode: { model: "openai:gpt-4o", small_model: "openai:gpt-4o-mini" },
    };
    await launchOpencode(manifest, "/resolved/dir", [], spawner);

    // mkdirSync called (to ensure CURRENT_FILE parent dir exists)
    expect(mkdirSyncSpy).toHaveBeenCalled();
    // writeFileSync called with CURRENT_FILE path containing stack name + dir
    expect(writeFileSyncSpy).toHaveBeenCalled();
    const [filePath, content] = writeFileSyncSpy.mock.calls[0]!;
    expect(String(filePath)).toContain(".current");
    expect(String(content)).toContain("my-stack");
    expect(String(content)).toContain("/resolved/dir");
  });

  it("returns exit code from child process", async () => {
    const { launchOpencode } = await import("../src/launch.ts");
    const spawner = new MockSpawner(() => fakeChild(42));

    const manifest = { name: "s", description: "test", opencode: { model: "m", small_model: "s" } };
    const code = await launchOpencode(manifest, "/d", [], spawner);
    expect(code).toBe(42);
  });

  it("resolves 1 on spawn error", async () => {
    const { launchOpencode } = await import("../src/launch.ts");
    const spawner = new MockSpawner(() => fakeChildError(new Error("ENOENT")));

    const manifest = { name: "s", description: "test", opencode: { model: "m", small_model: "s" } };
    const code = await launchOpencode(manifest, "/d", [], spawner);

    expect(code).toBe(1);
    expect(errorOutput.join("\n")).toContain("Failed to launch opencode");
    expect(errorOutput.join("\n")).toContain("ENOENT");
  });

  it("resolves 0 when child exits with null code", async () => {
    const { launchOpencode } = await import("../src/launch.ts");
    const spawner = new MockSpawner(() => fakeChild(null));

    const manifest = { name: "s", description: "test", opencode: { model: "m", small_model: "s" } };
    const code = await launchOpencode(manifest, "/d", [], spawner);
    expect(code).toBe(0);
  });

  it("merges manifest.env into spawned process env", async () => {
    const { launchOpencode } = await import("../src/launch.ts");
    const spawner = new MockSpawner(() => fakeChild(0));

    const manifest = {
      name: "s",
      description: "test",
      opencode: { model: "m", small_model: "s" },
      env: { ALPHA: "1", BETA: "2" },
    };
    await launchOpencode(manifest, "/d", [], spawner);

    const env = spawner.calls[0]!.opts.env!;
    expect(env.ALPHA).toBe("1");
    expect(env.BETA).toBe("2");
    expect(env.OPENCODE_CONFIG_DIR).toBe("/d");
    // process.env is spread in (use a key guaranteed to exist)
    expect(env.HOME ?? env.USERPROFILE ?? env.PATH ?? env.Path).toBeDefined();
  });

  it("uses default spawner when none provided", async () => {
    const { launchOpencode, DefaultSpawner } = await import("../src/launch.ts");
    // DefaultSpawner should be exported and usable
    expect(DefaultSpawner).toBeDefined();
    const spawner = new DefaultSpawner();
    expect(typeof spawner.spawn).toBe("function");
  });

  it("DefaultSpawner.spawn delegates to child_process.spawn", async () => {
    const { DefaultSpawner } = await import("../src/launch.ts");
    const cpMod = await import("node:child_process");
    const spawnSpy = spyOn(cpMod, "spawn").mockImplementation(() => fakeChild(0));

    const spawner = new DefaultSpawner();
    const result = spawner.spawn("echo", ["hello"], { stdio: "pipe" });

    expect(spawnSpy).toHaveBeenCalled();
    expect(spawnSpy.mock.calls[0]![0]).toBe("echo");
    expect(spawnSpy.mock.calls[0]![1]).toEqual(["hello"]);
    spawnSpy.mockRestore();
  });
});
