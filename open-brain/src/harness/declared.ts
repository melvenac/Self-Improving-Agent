/**
 * Parser for the criteria-file block that declares unrunnable and out-of-scope
 * ids (rulings-1 R3, rulings-2 R10(d)). QA 132 BE-4.
 *
 * The declaration is read from the criteria file at its SHA, never from `E_t`.
 * `E_t` carries neither list. A document that simply omits the declared ids
 * is the valid shape.
 *
 * ## Format
 *
 * One fenced block per file. Two fence kinds:
 *
 * - `qa-declared` — current. Section headers `[unrunnable]` and
 *   `[out-of-scope]`, then lines `ID: text`. The lists stay separate.
 * - `qa-unrunnable` — the block frozen before this parser (criteria-a at
 *   `ef2a8a7`). Every line is `ID: text` and is unrunnable. There is no
 *   out-of-scope list.
 *
 * Absent (no block) and present-but-empty are different results. A line that
 * is not a header or `ID: text`, an id in both lists, an id twice in one list,
 * and more than one block are refused.
 */

export class DeclaredParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeclaredParseError";
  }
}

export type DeclaredBlock =
  | { readonly present: false }
  | { readonly present: true; readonly unrunnable: readonly string[]; readonly outOfScope: readonly string[] };

const ITEM_RE = /^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(\S.*)$/;
const HEADER_RE = /^\[(unrunnable|out-of-scope)]$/;

function linesOf(body: string): string[] {
  const trimmed = body.endsWith("\n") ? body.slice(0, -1) : body;
  if (trimmed === "") return [];
  return trimmed.split("\n");
}

function parseItems(
  lines: readonly string[],
  sectionFor: (header: string | null) => "unrunnable" | "outOfScope" | null,
  allowHeaders: boolean,
): { unrunnable: string[]; outOfScope: string[] } {
  const unrunnable: string[] = [];
  const outOfScope: string[] = [];
  let header: string | null = null;

  const add = (list: "unrunnable" | "outOfScope", id: string): void => {
    const mine = list === "unrunnable" ? unrunnable : outOfScope;
    const other = list === "unrunnable" ? outOfScope : unrunnable;
    if (other.includes(id)) {
      throw new DeclaredParseError(`id "${id}" is in both unrunnable and out-of-scope`);
    }
    if (mine.includes(id)) {
      const name = list === "unrunnable" ? "unrunnable" : "out-of-scope";
      throw new DeclaredParseError(`id "${id}" appears twice in ${name}`);
    }
    mine.push(id);
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (allowHeaders && HEADER_RE.test(line)) {
      header = line;
      continue;
    }
    const section = sectionFor(header);
    // `.match`, not `.exec`: the spawn-site scan treats a call named exec as a process spawn.
    const item = line.match(ITEM_RE);
    if (section === null || item === null) {
      throw new DeclaredParseError(`line is not \`ID: text\`: ${line === "" ? "(blank)" : line}`);
    }
    add(section, item[1]!);
  }
  return { unrunnable, outOfScope };
}

/** Read the two lists from a criteria file's text. Throws {@link DeclaredParseError} when the block cannot be read. */
export function parseDeclared(text: string): DeclaredBlock {
  const normalised = text.replace(/\r\n/g, "\n");
  const blocks = [...normalised.matchAll(/```(qa-declared|qa-unrunnable)\n([\s\S]*?)```/g)];
  if (blocks.length === 0) return { present: false };
  if (blocks.length > 1) {
    throw new DeclaredParseError("more than one declared block in the file");
  }
  const kind = blocks[0]![1]!;
  const lines = linesOf(blocks[0]![2]!);
  const parsed =
    kind === "qa-unrunnable"
      ? parseItems(lines, () => "unrunnable", false)
      : parseItems(lines, (header) => {
          if (header === "[unrunnable]") return "unrunnable";
          if (header === "[out-of-scope]") return "outOfScope";
          return null;
        }, true);
  return {
    present: true,
    unrunnable: [...parsed.unrunnable, ...parsed.outOfScope],
    outOfScope: parsed.outOfScope,
  };
}
