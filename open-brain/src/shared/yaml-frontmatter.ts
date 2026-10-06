/** Scalar safe for a single-line YAML frontmatter value from untrusted input. */
export function yamlScalar(value: string): string {
  if (/^[\w.@/-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

/** Inline YAML array of scalars (tags, etc.). */
export function yamlInlineArray(items: string[]): string {
  return `[${items.map((item) => yamlScalar(item)).join(", ")}]`;
}
