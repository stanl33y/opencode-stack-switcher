import { createInterface } from "node:readline/promises";
import { existsSync, readFileSync } from "node:fs";
import { listStackNames, loadStack } from "./stacks.ts";
import { CURRENT_FILE } from "./paths.ts";

export function currentStack(): string | null {
  if (!existsSync(CURRENT_FILE)) return null;
  return readFileSync(CURRENT_FILE, "utf8").split("\n")[0]?.trim() || null;
}

/** Mostra lista numerada e devolve o nome escolhido (ou null se cancelado). */
export async function pickStack(): Promise<string | null> {
  const names = listStackNames();
  if (names.length === 0) {
    console.log("Nenhuma stack em stacks/. Crie um manifest .json.");
    return null;
  }
  const cur = currentStack();

  console.log("\nStacks disponíveis:\n");
  names.forEach((name, i) => {
    let desc = "";
    try {
      desc = loadStack(name).description ?? "";
    } catch {
      desc = "(manifest inválido)";
    }
    const mark = name === cur ? " ◀ atual" : "";
    console.log(`  ${String(i + 1).padStart(2)}. ${name.padEnd(18)} ${desc}${mark}`);
  });

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("\nEscolha (número ou nome, Enter cancela): ")).trim();
  rl.close();

  if (!answer) return null;
  const byIndex = Number.parseInt(answer, 10);
  if (!Number.isNaN(byIndex) && byIndex >= 1 && byIndex <= names.length) {
    return names[byIndex - 1]!;
  }
  if (names.includes(answer)) return answer;
  console.log(`'${answer}' não corresponde a nenhuma stack.`);
  return null;
}
