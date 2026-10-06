/** Scalar safe for a single-line YAML frontmatter value from untrusted input. */
export function yamlScalar(value: string): string {
  if (!yamlScalarNeedsQuotes(value)) return value;
  return JSON.stringify(value);
}

function yamlScalarNeedsQuotes(value: string): boolean {
  if (value === "") return true;
  if (value === "-") return true;
  if (value.startsWith("@")) return true;
  if (/^(true|false|null|~)$/i.test(value)) return true;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)) return true;
  if (/^-?0x[0-9a-f]+$/i.test(value)) return true;
  if (/[\n\r:\u0000]/.test(value)) return true;
  if (/^[\w.@/-]+$/.test(value)) return false;
  return true;
}

/** Inline YAML array of scalars (tags, etc.). */
export function yamlInlineArray(items: string[]): string {
  return `[${items.map((item) => yamlScalar(item)).join(", ")}]`;
}
