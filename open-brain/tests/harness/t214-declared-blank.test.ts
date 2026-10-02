/**
 * T-214 — P-blank: a whitespace-only line inside a declared block is not content.
 * Inserting or removing such lines anywhere never changes the parse; nothing else loosens.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DeclaredParseError, parseDeclared } from "../../src/harness/declared.js";

const C_CRITERIA = resolve(__dirname, "../../../docs/loops/loop-15-slice-3-c-criteria.md");

type Kind = "qa-declared" | "qa-unrunnable";
interface Base {
  readonly name: string;
  readonly kind: Kind;
  readonly lines: readonly string[];
}

const BASES: readonly Base[] = [
  { name: "both lists", kind: "qa-declared", lines: ["[unrunnable]", "A-1: one", "A-2: two", "[out-of-scope]", "B-1: three"] },
  { name: "out-of-scope first", kind: "qa-declared", lines: ["[out-of-scope]", "B-1: x", "B-2: y", "[unrunnable]", "A-1: z"] },
  { name: "unrunnable only", kind: "qa-declared", lines: ["[unrunnable]", "CC-23: a: with colon", "CC-24: b"] },
  { name: "headers only", kind: "qa-declared", lines: ["[unrunnable]", "[out-of-scope]"] },
  { name: "frozen form", kind: "qa-unrunnable", lines: ["X-1: one", "X-2: two", "X-3: three"] },
  { name: "frozen single", kind: "qa-unrunnable", lines: ["X-1: only"] },
];

const BLANKS = ["", " ", "\t", "  \t ", "\r", "    "];
const JUNK = [
  "junk line",
  "[bogus]",
  "- A-9: bullet",
  "no colon here",
  ":no id",
  "A-9:",
  "9-bad: id starts with a digit",
  "[unrunnable] trailing",
  "[ unrunnable ]",
  "A-9 :  ",
];

/** Small seeded PRNG (mulberry32): the generator is deterministic, so a failure reproduces. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const doc = (kind: Kind, lines: readonly string[], eol = "\n"): string =>
  `# criteria${eol}${eol}\`\`\`${kind}${eol}${lines.join(eol)}${eol}\`\`\`${eol}`;

/** Insert `items` at random positions (0..length inclusive: before the first line and at the end). */
function insertAt(lines: readonly string[], items: readonly string[], rand: () => number): string[] {
  const out = [...lines];
  for (const item of items) out.splice(Math.floor(rand() * (out.length + 1)), 0, item);
  return out;
}

const pick = <T>(xs: readonly T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)]!;

function refused(text: string): boolean {
  try {
    parseDeclared(text);
    return false;
  } catch (err) {
    return err instanceof DeclaredParseError;
  }
}

describe("T-214 P-blank", () => {
  it("B1 blank-insertion variants parse equal to the original (>= 200)", () => {
    const rand = rng(214);
    let n = 0;
    for (const base of BASES) {
      const expected = parseDeclared(doc(base.kind, base.lines));
      expect(expected.present).toBe(true);
      for (let i = 0; i < 40; i++) {
        const count = 1 + Math.floor(rand() * 5);
        const blanks = Array.from({ length: count }, () => pick(BLANKS, rand));
        const lines = insertAt(base.lines, blanks, rand);
        expect(parseDeclared(doc(base.kind, lines)), `${base.name}: ${JSON.stringify(lines)}`).toEqual(expected);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(200);
  });

  it("B2 the same holds for a CRLF file", () => {
    const rand = rng(215);
    for (const base of BASES) {
      const expected = parseDeclared(doc(base.kind, base.lines));
      for (let i = 0; i < 5; i++) {
        const lines = insertAt(base.lines, [pick(BLANKS, rand), pick(BLANKS, rand)], rand);
        expect(parseDeclared(doc(base.kind, lines, "\r\n")), `${base.name} CRLF`).toEqual(expected);
      }
    }
  });

  it("B3 the order of ids is unchanged by blank lines", () => {
    const r = parseDeclared(doc("qa-declared", ["", "[unrunnable]", "", "A-2: b", " ", "A-1: a", "\t", "[out-of-scope]", "", "B-2: d", "B-1: c", ""]));
    expect(r).toEqual({ present: true, unrunnable: ["A-2", "A-1"], outOfScope: ["B-2", "B-1"] });
  });

  it("J1 one non-blank junk line is still refused (>= 50)", () => {
    const rand = rng(216);
    let n = 0;
    for (const base of BASES) {
      for (const junk of JUNK) {
        const blanks = [pick(BLANKS, rand), pick(BLANKS, rand)];
        const lines = insertAt(insertAt(base.lines, [junk], rand), blanks, rand);
        expect(refused(doc(base.kind, lines)), `${base.name}: ${JSON.stringify(lines)}`).toBe(true);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(50);
  });

  it("J2 nothing else loosens", () => {
    expect(refused(doc("qa-declared", ["", "A-1: before any header", "[unrunnable]"]))).toBe(true);
    expect(refused(doc("qa-declared", ["[unrunnable]", "A-1: x", "", "[out-of-scope]", "A-1: y"]))).toBe(true);
    expect(refused(doc("qa-declared", ["[unrunnable]", "A-1: x", "", "A-1: y"]))).toBe(true);
    expect(refused(doc("qa-unrunnable", ["X-1: x", "", "X-1: y"]))).toBe(true);
    const two = `${doc("qa-declared", ["[unrunnable]", "A-1: x"])}\n${doc("qa-unrunnable", ["X-1: y"])}`;
    expect(refused(two)).toBe(true);
    // A non-breaking space is not a blank line: only spaces, tabs and a lone \r are.
    expect(refused(doc("qa-declared", ["[unrunnable]", " ", "A-1: x"]))).toBe(true);
  });

  it("J3 T-218: leading whitespace on a header or an item is refused, under both fence kinds", () => {
    const rows: [Kind, string[]][] = [
      ["qa-declared", [" [unrunnable]", "A-1: x"]],
      ["qa-declared", ["\t[unrunnable]", "A-1: x"]],
      ["qa-declared", ["[unrunnable]", "  A-1: x"]],
      ["qa-declared", ["[unrunnable]", "\tA-1: x"]],
      ["qa-declared", ["[unrunnable]", "A-1: x", " [out-of-scope]", "B-1: y"]],
      ["qa-unrunnable", ["  A-1: x"]],
      ["qa-unrunnable", ["\tA-1: x"]],
      ["qa-unrunnable", ["A-1: x", "  A-2: y"]],
      // A header has no meaning under the frozen fence: leading space or not, it is not an item.
      ["qa-unrunnable", [" [unrunnable]", "A-1: x"]],
    ];
    for (const [kind, lines] of rows) {
      expect(refused(doc(kind, lines)), `${kind} ${JSON.stringify(lines)}`).toBe(true);
    }
    // The same lines WITHOUT the leading whitespace parse, so each refusal above is the whitespace's doing.
    expect(parseDeclared(doc("qa-declared", ["[unrunnable]", "A-1: x"]))).toEqual({ present: true, unrunnable: ["A-1"], outOfScope: [] });
    expect(parseDeclared(doc("qa-unrunnable", ["A-1: x", "A-2: y"]))).toEqual({ present: true, unrunnable: ["A-1", "A-2"], outOfScope: [] });
  });

  it("E1 a block of only blank lines is present and empty, never absent", () => {
    for (const kind of ["qa-declared", "qa-unrunnable"] as const) {
      for (const lines of [[], [""], ["", " ", "\t"], ["\r", "   "]]) {
        expect(parseDeclared(doc(kind, lines)), `${kind} ${JSON.stringify(lines)}`).toEqual({
          present: true,
          unrunnable: [],
          outOfScope: [],
        });
      }
    }
    expect(parseDeclared("# no block\n")).toEqual({ present: false });
  });

  it("R1 the real slice-3 C criteria file parses (blank line between [unrunnable] and [out-of-scope])", () => {
    const r = parseDeclared(readFileSync(C_CRITERIA, "utf-8"));
    expect(r).toEqual({
      present: true,
      unrunnable: ["CC-23", "CC-24", "CC-25"],
      outOfScope: ["CC-26", "CC-27", "CC-28", "CC-21"],
    });
  });
});
