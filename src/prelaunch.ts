import { spawn } from "node:child_process";
import { connect } from "node:net";
import type { PrelaunchEntry } from "./stacks.ts";

function checkTcp(port: number, host = "127.0.0.1", timeoutMs = 1000): Promise<boolean> {
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

async function checkUrl(url: string, timeoutMs = 2000): Promise<boolean> {
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

async function isHealthy(entry: PrelaunchEntry): Promise<boolean> {
  if (entry.check.tcp != null) return checkTcp(entry.check.tcp);
  if (entry.check.url) return checkUrl(entry.check.url);
  return true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * For each server: if alive, continue. If down and has `start`, start it and wait for healthy.
 * If down and no `start`, return the name for the caller to report.
 * Returns list of unavailable servers (that did not come up).
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
