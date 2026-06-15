import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { CURRENT_FILE } from "./paths.ts";
import { loadStack } from "./stacks.ts";

export function currentStack(): string | null {
  if (!existsSync(CURRENT_FILE)) return null;
  return readFileSync(CURRENT_FILE, "utf8").split("\n")[0]?.trim() || null;
}

/** Injectable interface for stack selection (display + input). */
export interface StackPicker {
  pick(names: string[]): Promise<string | null>;
}

/** Interactive picker using readline — shows numbered list, reads user input. */
export class ReadlineStackPicker implements StackPicker {
  async pick(names: string[]): Promise<string | null> {
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
}

/**
 * Show available stacks and return the user's selection (or null on cancel).
 * @param stacks - list of stack names to present
 * @param picker - injectable picker (defaults to interactive readline)
 */
export async function pickStack(
  stacks: string[],
  picker: StackPicker = new ReadlineStackPicker(),
): Promise<string | null> {
  if (stacks.length === 0) {
    console.log("Nenhuma stack em stacks/. Crie um manifest .json.");
    return null;
  }
  return picker.pick(stacks);
}
