import { spawn } from "node:child_process";
import { connect } from "node:net";
import { HealthCheckTimeoutError } from "./errors.ts";
import type { PrelaunchEntry } from "./stacks.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Internal single-attempt TCP check.
 */
function checkTcpOnce(port: number, host = "127.0.0.1", timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = connect({ port, host });
    const done = (ok: boolean) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}

/**
 * TCP health check with retry and exponential backoff.
 *
 * Attempts to connect to the specified port, retrying up to `maxRetries` times
 * with exponential backoff between attempts.
 *
 * @param port - TCP port to check
 * @param host - Host address (default "127.0.0.1")
 * @param timeoutMs - Per-attempt connection timeout in ms (default 1000)
 * @param maxRetries - Maximum number of connection attempts (default 3)
 * @param baseDelay - Base delay in ms for exponential backoff (default 100)
 * @returns true if the connection succeeds
 * @throws {HealthCheckTimeoutError} When all retry attempts are exhausted
 *
 * @example
 * ```typescript
 * await checkTcp(3000); // Check localhost:3000 with defaults
 * ```
 */
export async function checkTcp(
  port: number,
  host = "127.0.0.1",
  timeoutMs = 1000,
  maxRetries = 3,
  baseDelay = 100,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const ok = await checkTcpOnce(port, host, timeoutMs);
    if (ok) return true;
    if (i < maxRetries - 1) await sleep(baseDelay * 2 ** i);
  }
  throw new HealthCheckTimeoutError(`tcp:${port}`, port, timeoutMs * maxRetries);
}

/**
 * Internal single-attempt URL check.
 */
async function checkUrlOnce(url: string, timeoutMs = 2000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok || res.status === 401 || res.status === 404; // server responded = alive
  } catch {
    return false;
  }
}

/**
 * URL health check with retry and exponential backoff.
 *
 * Attempts an HTTP request to the specified URL, retrying up to `maxRetries` times
 * with exponential backoff. HTTP 401 and 404 responses count as "alive".
 *
 * @param url - URL to check
 * @param timeoutMs - Per-attempt request timeout in ms (default 2000)
 * @param maxRetries - Maximum number of request attempts (default 3)
 * @param baseDelay - Base delay in ms for exponential backoff (default 100)
 * @returns true if the URL responds (2xx, 401, or 404)
 * @throws {HealthCheckTimeoutError} When all retry attempts are exhausted
 *
 * @example
 * ```typescript
 * await checkUrl("http://localhost:3000/health");
 * ```
 */
export async function checkUrl(
  url: string,
  timeoutMs = 2000,
  maxRetries = 3,
  baseDelay = 100,
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const ok = await checkUrlOnce(url, timeoutMs);
    if (ok) return true;
    if (i < maxRetries - 1) await sleep(baseDelay * 2 ** i);
  }
  throw new HealthCheckTimeoutError(url, 0, timeoutMs * maxRetries);
}

async function isHealthy(entry: PrelaunchEntry): Promise<boolean> {
  try {
    if (entry.check.tcp != null) return await checkTcp(entry.check.tcp);
    if (entry.check.url) return await checkUrl(entry.check.url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs prelaunch checks and starts for a list of server entries.
 *
 * For each entry: if already healthy, continues. If down and has a `start` command,
 * starts it and waits for healthy. If down and no `start`, marks as unavailable.
 *
 * @param entries - Array of prelaunch entries to check/start
 * @returns Array of server names that were unavailable (did not come up)
 */
export async function runPrelaunch(entries: PrelaunchEntry[]): Promise<string[]> {
  const unavailable: string[] = [];

  for (const entry of entries) {
    process.stdout.write(`  • ${entry.name}: `);
    if (await isHealthy(entry)) {
      console.log("ok (already running)");
      continue;
    }

    if (!entry.start) {
      console.log("DOWN — no 'start' command configured");
      unavailable.push(entry.name);
      continue;
    }

    console.log("starting…");
    const child = spawn(entry.start, {
      shell: true,
      cwd: entry.cwd,
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    const timeout = entry.timeoutMs ?? 60000;
    const deadline = Date.now() + timeout;
    let up = false;
    while (Date.now() < deadline) {
      await sleep(1500);
      if (await isHealthy(entry)) {
        up = true;
        break;
      }
    }
    if (up) {
      console.log(`    ${entry.name}: ready`);
    } else {
      console.log(`    ${entry.name}: TIMEOUT after ${Math.round(timeout / 1000)}s`);
      unavailable.push(entry.name);
    }
  }

  return unavailable;
}
