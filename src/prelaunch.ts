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
    return res.ok || res.status === 401 || res.status === 404; // servidor respondeu = vivo
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
 * Para cada servidor: se vivo, segue. Se morto e tem `start`, sobe e espera ficar saudável.
 * Se morto e sem `start`, retorna o nome p/ o caller avisar.
 * Retorna lista de servidores indisponíveis (que não subiram).
 */
export async function runPrelaunch(entries: PrelaunchEntry[]): Promise<string[]> {
  const unavailable: string[] = [];

  for (const entry of entries) {
    process.stdout.write(`  • ${entry.name}: `);
    if (await isHealthy(entry)) {
      console.log("ok (já no ar)");
      continue;
    }

    if (!entry.start) {
      console.log("DOWN — sem comando 'start' configurado");
      unavailable.push(entry.name);
      continue;
    }

    console.log("subindo…");
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
      console.log(`    ${entry.name}: pronto`);
    } else {
      console.log(`    ${entry.name}: TIMEOUT após ${Math.round(timeout / 1000)}s`);
      unavailable.push(entry.name);
    }
  }

  return unavailable;
}
