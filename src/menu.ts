import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { CURRENT_FILE } from "./paths.ts";
import { loadStack } from "./stacks.ts";

/**
 * Returns the name of the currently active stack, or null if none is set.
 *
 * Reads from the .current file written by launchOpencode.
 *
 * @returns The active stack name, or null if no stack has been activated
 */
export function currentStack(): string | null {
  if (!existsSync(CURRENT_FILE)) return null;
  return readFileSync(CURRENT_FILE, "utf8").split("\n")[0]?.trim() || null;
}

/**
 * Injectable interface for stack selection (display + input).
 *
 * @example
 * ```typescript
 * const picker: StackPicker = {
 *   async pick(names) { return names[0] ?? null; }
 * };
 * ```
 */
export interface StackPicker {
  /**
   * Display stack list and return the user's selection.
   *
   * @param names - Available stack names to present
   * @returns Selected stack name, or null if cancelled
   */
  pick(names: string[]): Promise<string | null>;
}

/** Interactive picker using readline. Shows a numbered list and reads user input. */
export class ReadlineStackPicker implements StackPicker {
  /**
   * Displays available stacks with descriptions and prompts for selection.
   *
   * @param names - Stack names to display
   * @returns Selected stack name, or null if the user cancels
   */
  async pick(names: string[]): Promise<string | null> {
    const cur = currentStack();

    console.log("\nAvailable stacks:\n");
    names.forEach((name, i) => {
      let desc = "";
      try {
        desc = loadStack(name).description ?? "";
      } catch {
        desc = "(invalid manifest)";
      }
      const mark = name === cur ? " ◀ current" : "";
      console.log(`  ${String(i + 1).padStart(2)}. ${name.padEnd(18)} ${desc}${mark}`);
    });

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question("\nChoose (number or name, Enter cancels): ")).trim();
    rl.close();

    if (!answer) return null;
    const byIndex = Number.parseInt(answer, 10);
    if (!Number.isNaN(byIndex) && byIndex >= 1 && byIndex <= names.length) {
      return names[byIndex - 1]!;
    }
    if (names.includes(answer)) return answer;
    console.log(`'${answer}' does not match any stack.`);
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
    console.log("No stacks in stacks/. Create a .json manifest.");
    return null;
  }
  return picker.pick(stacks);
}
