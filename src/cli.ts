#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OPENCODE_CONFIG_DIR, STACKS_DIR } from "./paths.ts";
import { listStackNames, loadStack } from "./stacks.ts";
import { parseJsonc } from "./jsonc.ts";
import { resolveStack } from "./resolve.ts";
import { runPrelaunch } from "./prelaunch.ts";
import { launchOpencode } from "./launch.ts";
import { pickStack, currentStack } from "./menu.ts";

function splitArgs(argv: string[]): { args: string[]; passthrough: string[] } {
  const sep = argv.indexOf("--");
  if (sep === -1) return { args: argv, passthrough: [] };
  return { args: argv.slice(0, sep), passthrough: argv.slice(sep + 1) };
}

async function cmdUse(name: string, passthrough: string[]) {
  const manifest = loadStack(name);
  console.log(`Resolvendo stack '${name}'…`);
  const { dir } = resolveStack(manifest);

  if (manifest.prelaunch?.length) {
    console.log("Prelaunch (servidores locais):");
    const down = await runPrelaunch(manifest.prelaunch);
    if (down.length) {
      console.log(`\n⚠ Indisponíveis: ${down.join(", ")}. Lançando opencode mesmo assim.`);
    }
  }

  const code = await launchOpencode(manifest, dir, passthrough);
  process.exit(code);
}

function cmdList() {
  const names = listStackNames();
  const cur = currentStack();
  if (!names.length) {
    console.log("Nenhuma stack em stacks/.");
    return;
  }
  console.log("Stacks:");
  for (const name of names) {
    let desc = "";
    try {
      desc = loadStack(name).description ?? "";
    } catch {
      desc = "(manifest inválido)";
    }
    const mark = name === cur ? " ◀ atual" : "";
    console.log(`  ${name.padEnd(18)} ${desc}${mark}`);
  }
}

function cmdShow(name: string) {
  const manifest = loadStack(name);
  const { opencode, omo, dir } = resolveStack(manifest);
  console.log(`# resolved/${name}  (${dir})\n`);
  console.log("## opencode.json (model/small_model/agent)");
  console.log(JSON.stringify(
    { model: opencode.model, small_model: opencode.small_model, agent: opencode.agent },
    null, 2,
  ));
  console.log("\n## oh-my-opencode.json");
  console.log(JSON.stringify(omo, null, 2));
}

function cmdCurrent() {
  const cur = currentStack();
  console.log(cur ? `Stack ativa: ${cur}` : "Nenhuma stack ativada ainda.");
}

async function cmdDoctor() {
  console.log(`Config dir global: ${OPENCODE_CONFIG_DIR}`);
  console.log(`base.json: ${existsSync(join(STACKS_DIR, "base.json")) ? "ok" : "AUSENTE — rode 'ocs init'"}`);
  const keys = ["ZAI_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"];
  console.log("\nVariáveis de ambiente de provider:");
  for (const k of keys) {
    console.log(`  ${k}: ${process.env[k] ? "definida" : "—"}`);
  }
  console.log("\nPrelaunch por stack (health-check):");
  for (const name of listStackNames()) {
    const m = loadStack(name);
    if (!m.prelaunch?.length) continue;
    console.log(`  [${name}]`);
    await runPrelaunch(m.prelaunch);
  }
}

function cmdEdit(name: string) {
  const path = join(STACKS_DIR, `${name}.json`);
  if (!existsSync(path)) {
    console.error(`Stack '${name}' não existe (${path}).`);
    process.exit(1);
  }
  const editor = process.env.EDITOR || (process.platform === "win32" ? "notepad" : "vi");
  const child = spawn(editor, [path], { stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code) => process.exit(code ?? 0));
}

/** Gera stacks/base.json a partir do opencode.json global, removendo overlays variáveis. */
function cmdInit() {
  const src = join(OPENCODE_CONFIG_DIR, "opencode.json");
  if (!existsSync(src)) {
    console.error(`Não achei ${src} para gerar base.json.`);
    process.exit(1);
  }
  const cfg = parseJsonc<Record<string, unknown>>(readFileSync(src, "utf8"));
  delete cfg.model;
  delete cfg.small_model;
  const out = join(STACKS_DIR, "base.json");
  writeFileSync(out, JSON.stringify(cfg, null, 2) + "\n");
  console.log(`base.json gerado: ${out}\n(providers/mcp/tools/plugin preservados; model/small_model removidos)`);
}

function usage() {
  console.log(`ocs — OpenCode Stack Switcher

  ocs                      menu interativo
  ocs use <stack> [-- ...] resolve, prelaunch e lança opencode (args após -- vão p/ opencode)
  ocs list                 lista stacks
  ocs show <stack>         mostra config resolvido
  ocs current              stack ativa
  ocs doctor               checa base/keys/portas
  ocs edit <stack>         abre manifest no \$EDITOR
  ocs init                 (re)gera stacks/base.json do config global
`);
}

async function main() {
  const { args, passthrough } = splitArgs(process.argv.slice(2));
  const [cmd, arg] = args;

  switch (cmd) {
    case undefined: {
      const picked = await pickStack();
      if (picked) await cmdUse(picked, passthrough);
      break;
    }
    case "use":
      if (!arg) { console.error("uso: ocs use <stack>"); process.exit(1); }
      await cmdUse(arg, passthrough);
      break;
    case "list": cmdList(); break;
    case "show":
      if (!arg) { console.error("uso: ocs show <stack>"); process.exit(1); }
      cmdShow(arg); break;
    case "current": cmdCurrent(); break;
    case "doctor": await cmdDoctor(); break;
    case "edit":
      if (!arg) { console.error("uso: ocs edit <stack>"); process.exit(1); }
      cmdEdit(arg); break;
    case "init": cmdInit(); break;
    case "help": case "-h": case "--help": usage(); break;
    default:
      // atalho: `ocs <stack>` == `ocs use <stack>`
      if (listStackNames().includes(cmd)) { await cmdUse(cmd, passthrough); break; }
      console.error(`comando desconhecido: ${cmd}`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
