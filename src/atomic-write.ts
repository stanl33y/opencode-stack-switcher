import { renameSync, unlinkSync, writeFileSync } from "node:fs";

/**
 * Atomically writes content to a file.
 *
 * Uses a temp-file + rename pattern to prevent partial/corrupt writes:
 * 1. Write content to `path.tmp`
 * 2. Rename `path.tmp` → `path` (atomic on most filesystems)
 * 3. On any failure, clean up the temp file and rethrow the error
 */
export function atomicWrite(path: string, content: string): void {
  const tmpPath = `${path}.tmp`;
  try {
    writeFileSync(tmpPath, content);
    renameSync(tmpPath, path);
  } catch (err) {
    // Best-effort cleanup of the temp file — swallow its error
    // so the original failure is always the one that propagates.
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup errors
    }
    throw err;
  }
}
