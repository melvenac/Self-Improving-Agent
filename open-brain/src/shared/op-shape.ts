import { z } from "zod";

/**
 * T-271: an ob_state op's expected shape as one line of text, derived from its zod schema through zod 4's public
 * z.toJSONSchema, so the shape a refusal prints cannot drift from the schema that refused.
 */

/** The longest expected-shape line a refusal prints; a longer one is cut with "…". */
export const SHAPE_MAX = 800;

type JsonNode = Record<string, unknown>;

/** One node of z.toJSONSchema's output as compact text. Properties print in schema order; `?` marks an optional key. */
export function renderJsonShape(s: JsonNode): string {
  if (Array.isArray(s.anyOf)) return (s.anyOf as JsonNode[]).map(renderJsonShape).join(" | ");
  if ("const" in s) return JSON.stringify(s.const);
  if (Array.isArray(s.enum)) return (s.enum as unknown[]).map((v) => JSON.stringify(v)).join("|");
  switch (s.type) {
    case "object": {
      const required = new Set(Array.isArray(s.required) ? (s.required as string[]) : []);
      const props = Object.entries((s.properties ?? {}) as Record<string, JsonNode>);
      return `{${props.map(([k, v]) => `${k}${required.has(k) ? "" : "?"}: ${renderJsonShape(v)}`).join(", ")}}`;
    }
    case "array": {
      const items = renderJsonShape((s.items ?? {}) as JsonNode);
      const n = s.minItems;
      const min = typeof n === "number" && n > 0 ? (n === 1 ? " (non-empty)" : ` (>= ${n} items)`) : "";
      return `[${items}]${min}`;
    }
    case "string": {
      const parts: string[] = [];
      const n = s.minLength;
      if (typeof n === "number" && n > 0) parts.push(n === 1 ? "non-empty" : `length >= ${n}`);
      if (typeof s.pattern === "string") parts.push(`matching /${s.pattern}/`);
      return parts.length > 0 ? `string (${parts.join(", ")})` : "string";
    }
    case "integer":
    case "number": {
      // zod 4's int() puts the safe-integer range into the JSON Schema; only a bound the schema set is shown.
      if (typeof s.exclusiveMinimum === "number") return `${String(s.type)} (> ${s.exclusiveMinimum})`;
      if (typeof s.minimum === "number" && s.minimum > Number.MIN_SAFE_INTEGER) return `${String(s.type)} (>= ${s.minimum})`;
      return String(s.type);
    }
    case "boolean":
    case "null":
      return String(s.type);
    default:
      return "unknown";
  }
}

/** A zod schema's expected shape as one line, cut at SHAPE_MAX characters. */
export function describeShape(schema: z.ZodType): string {
  const line = renderJsonShape(z.toJSONSchema(schema) as JsonNode);
  return line.length > SHAPE_MAX ? `${line.slice(0, SHAPE_MAX - 1)}…` : line;
}
