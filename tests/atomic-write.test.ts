import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

describe("atomicWrite", () => {
  let writeFileSyncSpy: ReturnType<typeof spyOn>;
  let renameSyncSpy: ReturnType<typeof spyOn>;
  let unlinkSyncSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    const fsMod = await import("node:fs");
    writeFileSyncSpy = spyOn(fsMod, "writeFileSync").mockImplementation(() => undefined);
    renameSyncSpy = spyOn(fsMod, "renameSync").mockImplementation(() => undefined);
    unlinkSyncSpy = spyOn(fsMod, "unlinkSync").mockImplementation(() => undefined);
  });

  afterEach(() => {
    writeFileSyncSpy.mockRestore();
    renameSyncSpy.mockRestore();
    unlinkSyncSpy.mockRestore();
  });

  it("writes to .tmp then renames to target", async () => {
    const { atomicWrite } = await import("../src/atomic-write.ts");
    atomicWrite("/path/to/file", "hello");

    // Writes to temp file first
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(String(writeFileSyncSpy.mock.calls[0]![0])).toBe("/path/to/file.tmp");
    expect(String(writeFileSyncSpy.mock.calls[0]![1])).toBe("hello");

    // Renames to target
    expect(renameSyncSpy).toHaveBeenCalledTimes(1);
    expect(String(renameSyncSpy.mock.calls[0]![0])).toBe("/path/to/file.tmp");
    expect(String(renameSyncSpy.mock.calls[0]![1])).toBe("/path/to/file");

    // No cleanup needed
    expect(unlinkSyncSpy).not.toHaveBeenCalled();
  });

  it("rethrows writeFileSync error and cleans up temp file", async () => {
    let cleanedUp = false;
    writeFileSyncSpy.mockImplementation(() => {
      throw new Error("disk full");
    });
    unlinkSyncSpy.mockImplementation(() => {
      cleanedUp = true;
    });

    const { atomicWrite } = await import("../src/atomic-write.ts");
    expect(() => atomicWrite("/path/to/file", "hello")).toThrow("disk full");

    // Temp file cleaned up
    expect(unlinkSyncSpy).toHaveBeenCalledTimes(1);
    expect(String(unlinkSyncSpy.mock.calls[0]![0])).toBe("/path/to/file.tmp");

    // Rename never attempted
    expect(renameSyncSpy).not.toHaveBeenCalled();
  });

  it("rethrows renameSync error and cleans up temp file", async () => {
    let cleanedUp = false;
    renameSyncSpy.mockImplementation(() => {
      throw new Error("rename failed");
    });
    unlinkSyncSpy.mockImplementation(() => {
      cleanedUp = true;
    });

    const { atomicWrite } = await import("../src/atomic-write.ts");
    expect(() => atomicWrite("/path/to/file", "hello")).toThrow("rename failed");

    // Temp file cleaned up
    expect(unlinkSyncSpy).toHaveBeenCalledTimes(1);
    expect(String(unlinkSyncSpy.mock.calls[0]![0])).toBe("/path/to/file.tmp");

    // Write did happen (before rename)
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
  });

  it("swallows cleanup error and rethrows original error", async () => {
    writeFileSyncSpy.mockImplementation(() => {
      throw new Error("original error");
    });
    unlinkSyncSpy.mockImplementation(() => {
      throw new Error("cleanup also failed");
    });

    const { atomicWrite } = await import("../src/atomic-write.ts");
    // Original error, not cleanup error
    expect(() => atomicWrite("/path/to/file", "hello")).toThrow("original error");

    // Cleanup was at least attempted
    expect(unlinkSyncSpy).toHaveBeenCalledTimes(1);
  });

  it("handle paths with existing dots (.txt)", async () => {
    const { atomicWrite } = await import("../src/atomic-write.ts");
    atomicWrite("/path/to/file.txt", "hello");

    const tmpPath = String(writeFileSyncSpy.mock.calls[0]![0]);
    expect(tmpPath).toBe("/path/to/file.txt.tmp");

    const [renameFrom, renameTo] = renameSyncSpy.mock.calls[0]!;
    expect(String(renameFrom)).toBe("/path/to/file.txt.tmp");
    expect(String(renameTo)).toBe("/path/to/file.txt");
  });
});
