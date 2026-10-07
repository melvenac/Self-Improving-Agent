/** Strip a leading UTF-8 BOM so `---` frontmatter still parses. */
function stripLeadingBom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

/** Unquote a scalar written by {@link yamlScalar} (JSON string form). */
export function parseFrontmatterScalar(value: string): string {
  const v = value.trim();
  if (v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v) as string;
    } catch {
      return v.slice(1, -1);
    }
  }
  return v;
}

function parseInlineArrayInner(inner: string): string[] {
  const trimmed = inner.trim();
  if (!trimmed) return [];
  const items: string[] = [];
  let rest = trimmed;
  while (rest.length > 0) {
    rest = rest.trimStart();
    if (!rest) break;
    if (rest.startsWith('"')) {
      let i = 1;
      while (i < rest.length) {
        if (rest[i] === "\\") {
          i += 2;
          continue;
        }
        if (rest[i] === '"') break;
        i++;
      }
      const chunk = rest.slice(0, i + 1);
      items.push(JSON.parse(chunk) as string);
      rest = rest.slice(i + 1);
      if (rest.startsWith(",")) rest = rest.slice(1);
      continue;
    }
    const comma = rest.indexOf(",");
    const piece = comma === -1 ? rest : rest.slice(0, comma);
    items.push(parseFrontmatterScalar(piece));
    rest = comma === -1 ? "" : rest.slice(comma + 1);
  }
  return items;
}

/** Parse a YAML inline `[a, b]` list; never throws on hand-edited garbage. */
export function parseInlineArray(inner: string): string[] {
  try {
    return parseInlineArrayInner(inner);
  } catch {
    const trimmed = inner.trim();
    return trimmed ? [trimmed] : [];
  }
}

/** Minimal YAML-like frontmatter reader for vault notes (line-based `key: value`). */
export function parseFrontmatter(raw: string): Record<string, unknown> {
  const match = stripLeadingBom(raw).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const result: Record<string, unknown> = {};
  const lines = match[1].split(/\r?\n/);

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (!key) continue;

    if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = parseInlineArray(value.slice(1, -1));
      continue;
    }

    const scalar = parseFrontmatterScalar(value);
    if (/^-?\d+(\.\d+)?$/.test(scalar) && !value.startsWith('"')) {
      result[key] = Number(scalar);
      continue;
    }

    result[key] = scalar;
  }

  return result;
}
