import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { StackPicker } from "../src/menu.ts";
import { pickStack } from "../src/menu.ts";

/** Minimal mock that always returns a fixed value from pick(). */
class MockStackPicker implements StackPicker {
  result: string | null;
  calledWith: string[] = [];
  constructor(result: string | null) {
    this.result = result;
  }
  async pick(names: string[]): Promise<string | null> {
    this.calledWith = [...names];
    return this.result;
  }
}

describe("pickStack", () => {
  let consoleSpy: ReturnType<typeof mock>;
  let logOutput: string[];

  beforeEach(() => {
    logOutput = [];
    consoleSpy = mock((msg: string) => logOutput.push(msg));
    console.log = consoleSpy;
  });

  afterEach(() => {
    console.log = globalThis.console.log;
  });

  it("returns selected stack when picker resolves a name", async () => {
    const picker = new MockStackPicker("alpha");
    const result = await pickStack(["alpha", "beta", "gamma"], picker);
    expect(result).toBe("alpha");
    expect(picker.calledWith).toEqual(["alpha", "beta", "gamma"]);
  });

  it("returns null when picker returns null (user cancelled)", async () => {
    const picker = new MockStackPicker(null);
    const result = await pickStack(["alpha", "beta"], picker);
    expect(result).toBeNull();
  });

  it("returns null and logs message when stacks list is empty", async () => {
    const picker = new MockStackPicker("alpha");
    const result = await pickStack([], picker);
    expect(result).toBeNull();
    expect(picker.calledWith).toEqual([]);
    expect(logOutput.join("\n")).toContain("No stacks in stacks/");
  });

  it("delegates picker with exact stack names array", async () => {
    const picker = new MockStackPicker(null);
    const stacks = ["zebra", "alpha", "middle"];
    await pickStack(stacks, picker);
    expect(picker.calledWith).toEqual(stacks);
  });

  it("returns the name the picker resolves (e.g. by index)", async () => {
    const picker = new MockStackPicker("beta");
    const result = await pickStack(["alpha", "beta", "gamma"], picker);
    expect(result).toBe("beta");
  });
});

describe("currentStack", () => {
  let fsMod: typeof import("node:fs");
  let existsSyncSpy: ReturnType<typeof spyOn>;
  let readFileSyncSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    fsMod = await import("node:fs");
    existsSyncSpy = spyOn(fsMod, "existsSync");
    readFileSyncSpy = spyOn(fsMod, "readFileSync");
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
  });

  it("returns null when CURRENT_FILE does not exist", async () => {
    existsSyncSpy.mockImplementation(() => false);
    const { currentStack } = await import("../src/menu.ts");
    const result = currentStack();
    expect(result).toBeNull();
  });

  it("returns trimmed first line when CURRENT_FILE exists", async () => {
    existsSyncSpy.mockImplementation(() => true);
    readFileSyncSpy.mockImplementation(() => "my-stack\nextra-data\n");
    const { currentStack } = await import("../src/menu.ts");
    const result = currentStack();
    expect(result).toBe("my-stack");
  });

  it("returns null when CURRENT_FILE is empty", async () => {
    existsSyncSpy.mockImplementation(() => true);
    readFileSyncSpy.mockImplementation(() => "");
    const { currentStack } = await import("../src/menu.ts");
    const result = currentStack();
    expect(result).toBeNull();
  });
});

// ── ReadlineStackPicker tests ──────────────────────────────────────────────
// mock.module replaces the module for this file's process. We set it up once
// here and rely on Bun's per-file isolation (each .test.ts runs in its own
// process) so we never need to undo it.

const makeMockRl = (answer: string) => ({
  question: mock(async (_prompt: string) => answer),
  close: mock(() => {}),
});

mock.module("node:readline/promises", () => ({
  createInterface: (_opts: unknown) => makeMockRl(""),
}));

describe("ReadlineStackPicker", () => {
  let consoleSpy: ReturnType<typeof mock>;
  let logOutput: string[];
  let fsMod: typeof import("node:fs");
  let stacksMod: typeof import("../src/stacks.ts");
  let existsSyncSpy: ReturnType<typeof spyOn>;
  let readFileSyncSpy: ReturnType<typeof spyOn>;
  let loadStackSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    logOutput = [];
    consoleSpy = mock((msg: string) => logOutput.push(msg));
    console.log = consoleSpy;

    fsMod = await import("node:fs");
    stacksMod = await import("../src/stacks.ts");
    existsSyncSpy = spyOn(fsMod, "existsSync").mockImplementation(() => false);
    readFileSyncSpy = spyOn(fsMod, "readFileSync").mockImplementation(
      (() => "") as unknown as typeof fsMod.readFileSync,
    );
    loadStackSpy = spyOn(stacksMod, "loadStack").mockImplementation((name: string) => ({
      name,
      description: `Desc for ${name}`,
    }));
  });

  afterEach(() => {
    console.log = globalThis.console.log;
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    loadStackSpy.mockRestore();
  });

  it("returns selected stack by index number", async () => {
    const rl = makeMockRl("2");
    mock.module("node:readline/promises", () => ({
      createInterface: () => rl,
    }));

    const { ReadlineStackPicker } = await import("../src/menu.ts");
    const picker = new ReadlineStackPicker();
    const result = await picker.pick(["alpha", "beta", "gamma"]);
    expect(result).toBe("beta");
    expect(rl.close).toHaveBeenCalled();
  });

  it("returns null when user presses Enter (empty answer)", async () => {
    const rl = makeMockRl("");
    mock.module("node:readline/promises", () => ({
      createInterface: () => rl,
    }));

    const { ReadlineStackPicker } = await import("../src/menu.ts");
    const picker = new ReadlineStackPicker();
    const result = await picker.pick(["alpha"]);
    expect(result).toBeNull();
  });

  it("returns stack name when user types exact name", async () => {
    const rl = makeMockRl("gamma");
    mock.module("node:readline/promises", () => ({
      createInterface: () => rl,
    }));

    const { ReadlineStackPicker } = await import("../src/menu.ts");
    const picker = new ReadlineStackPicker();
    const result = await picker.pick(["alpha", "beta", "gamma"]);
    expect(result).toBe("gamma");
  });

  it("returns null and logs error for invalid input", async () => {
    const rl = makeMockRl("invalid");
    mock.module("node:readline/promises", () => ({
      createInterface: () => rl,
    }));

    const { ReadlineStackPicker } = await import("../src/menu.ts");
    const picker = new ReadlineStackPicker();
    const result = await picker.pick(["alpha", "beta"]);
    expect(result).toBeNull();
    expect(logOutput.join("\n")).toContain("does not match any stack");
  });

  it("returns null when input is whitespace only", async () => {
    const rl = makeMockRl("   ");
    mock.module("node:readline/promises", () => ({
      createInterface: () => rl,
    }));

    const { ReadlineStackPicker } = await import("../src/menu.ts");
    const picker = new ReadlineStackPicker();
    const result = await picker.pick(["alpha", "beta"]);
    expect(result).toBeNull();
  });
});
