import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";
import { HealthCheckTimeoutError } from "../src/errors";

// ── Mock Helpers ────────────────────────────────────────────────────────────

/** Creates a fake socket that emits the specified event */
function createFakeSocket(behavior: "connect" | "timeout" | "error") {
  const ee = new EventEmitter() as EventEmitter & {
    destroy: () => void;
    setTimeout: (ms: number) => void;
  };
  ee.destroy = mock(() => {});
  ee.setTimeout = mock(() => {});
  process.nextTick(() => {
    if (behavior === "connect") ee.emit("connect");
    else if (behavior === "timeout") ee.emit("timeout");
    else ee.emit("error", new Error("ECONNREFUSED"));
  });
  return ee;
}

// ── Mocks ───────────────────────────────────────────────────────────────────

let connectCalls: number;
let connectBehavior: ("connect" | "timeout" | "error")[];
let fetchCalls: number;
let fetchBehavior: ("ok" | "fail" | "401" | "404")[];

beforeEach(() => {
  connectCalls = 0;
  connectBehavior = [];
  fetchCalls = 0;
  fetchBehavior = [];
});

// Mock node:net module
mock.module("node:net", () => ({
  connect: mock((opts: { port: number; host: string }) => {
    const behavior = connectBehavior[connectCalls] ?? "error";
    connectCalls++;
    return createFakeSocket(behavior);
  }),
}));

// Mock global fetch
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = mock(async (url: string | URL | Request) => {
    const behavior = fetchBehavior[fetchCalls] ?? "fail";
    fetchCalls++;
    if (behavior === "fail") throw new Error("fetch failed");
    if (behavior === "ok") return new Response("ok", { status: 200 });
    if (behavior === "401") return new Response("unauthorized", { status: 401 });
    if (behavior === "404") return new Response("not found", { status: 404 });
    throw new Error("unexpected behavior");
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("checkTcp with retry", () => {
  test("all retries fail → throws HealthCheckTimeoutError", async () => {
    const { checkTcp } = await import("../src/prelaunch.ts");
    connectBehavior = ["error", "error", "error"];

    await expect(checkTcp(3000, "127.0.0.1", 1000, 3, 1)).rejects.toThrow(HealthCheckTimeoutError);
    expect(connectCalls).toBe(3);
  });

  test("first fails, second succeeds → returns true", async () => {
    const { checkTcp } = await import("../src/prelaunch.ts");
    connectBehavior = ["error", "connect"];

    const result = await checkTcp(3000, "127.0.0.1", 1000, 3, 1);
    expect(result).toBe(true);
    expect(connectCalls).toBe(2);
  });

  test("respects max retry config", async () => {
    const { checkTcp } = await import("../src/prelaunch.ts");
    connectBehavior = ["error", "error", "error", "error", "error"];

    await expect(checkTcp(3000, "127.0.0.1", 1000, 2, 1)).rejects.toThrow(HealthCheckTimeoutError);
    expect(connectCalls).toBe(2);
  });

  test("exponential backoff timing", async () => {
    const { checkTcp } = await import("../src/prelaunch.ts");
    connectBehavior = ["error", "error", "error"];

    const start = performance.now();
    await expect(checkTcp(3000, "127.0.0.1", 1000, 3, 50)).rejects.toThrow();
    const elapsed = performance.now() - start;

    // Expected delays: 50ms (1st retry) + 100ms (2nd retry) = 150ms minimum
    // Allow some tolerance for timing
    expect(elapsed).toBeGreaterThanOrEqual(140);
    expect(elapsed).toBeLessThan(300);
  });

  test("succeeds on first try → returns true immediately", async () => {
    const { checkTcp } = await import("../src/prelaunch.ts");
    connectBehavior = ["connect"];

    const result = await checkTcp(3000, "127.0.0.1", 1000, 3, 1);
    expect(result).toBe(true);
    expect(connectCalls).toBe(1);
  });

  test("timeout behavior triggers retry", async () => {
    const { checkTcp } = await import("../src/prelaunch.ts");
    connectBehavior = ["timeout", "connect"];

    const result = await checkTcp(3000, "127.0.0.1", 1000, 3, 1);
    expect(result).toBe(true);
    expect(connectCalls).toBe(2);
  });
});

describe("checkUrl with retry", () => {
  test("all retries fail → throws HealthCheckTimeoutError", async () => {
    const { checkUrl } = await import("../src/prelaunch.ts");
    fetchBehavior = ["fail", "fail", "fail"];

    await expect(checkUrl("http://localhost:3000/health", 1000, 3, 1)).rejects.toThrow(
      HealthCheckTimeoutError,
    );
    expect(fetchCalls).toBe(3);
  });

  test("first fails, second succeeds → returns true", async () => {
    const { checkUrl } = await import("../src/prelaunch.ts");
    fetchBehavior = ["fail", "ok"];

    const result = await checkUrl("http://localhost:3000/health", 1000, 3, 1);
    expect(result).toBe(true);
    expect(fetchCalls).toBe(2);
  });

  test("respects max retry config", async () => {
    const { checkUrl } = await import("../src/prelaunch.ts");
    fetchBehavior = ["fail", "fail", "fail", "fail"];

    await expect(checkUrl("http://localhost:3000/health", 1000, 2, 1)).rejects.toThrow(
      HealthCheckTimeoutError,
    );
    expect(fetchCalls).toBe(2);
  });

  test("exponential backoff timing", async () => {
    const { checkUrl } = await import("../src/prelaunch.ts");
    fetchBehavior = ["fail", "fail", "fail"];

    const start = performance.now();
    await expect(checkUrl("http://localhost:3000/health", 1000, 3, 50)).rejects.toThrow();
    const elapsed = performance.now() - start;

    // Expected delays: 50ms + 100ms = 150ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(140);
    expect(elapsed).toBeLessThan(300);
  });

  test("401 response counts as success (server responded)", async () => {
    const { checkUrl } = await import("../src/prelaunch.ts");
    fetchBehavior = ["401"];

    const result = await checkUrl("http://localhost:3000/health", 1000, 3, 1);
    expect(result).toBe(true);
    expect(fetchCalls).toBe(1);
  });

  test("404 response counts as success (server responded)", async () => {
    const { checkUrl } = await import("../src/prelaunch.ts");
    fetchBehavior = ["404"];

    const result = await checkUrl("http://localhost:3000/health", 1000, 3, 1);
    expect(result).toBe(true);
    expect(fetchCalls).toBe(1);
  });
});
