/** Parse JSON tolerant to comments and trailing commas (jsonc), as opencode accepts. */
export function parseJsonc<T = unknown>(text: string): T {
  const noComments = text
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // // ... (preserves http:// in values)
  const noTrailingCommas = noComments.replace(/,(\s*[}\]])/g, "$1");
  // SAFETY: JSON.parse returns `any`; the caller asserts the shape via the generic T parameter.
  return JSON.parse(noTrailingCommas) as T;
}
