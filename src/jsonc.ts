/** Parse JSON tolerante a comentários e trailing commas (jsonc), como o opencode aceita. */
export function parseJsonc<T = unknown>(text: string): T {
  const noComments = text
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // // ... (preserva http:// em valores)
  const noTrailingCommas = noComments.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(noTrailingCommas) as T;
}
