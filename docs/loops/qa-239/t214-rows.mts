// QA 239: explicit rows T214-2 (nothing else loosens, non-ASCII spaces), T214-3 (empty vs absent), T214-4 (real file).
// Usage: tsx t214-rows.mts <declared.ts> <criteria file> ; prints one JSON line per row.
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const [modPath, realPath] = process.argv.slice(2);
const { parseDeclared } = await import(pathToFileURL(modPath!).href);
const run = (t: string) => { try { return { ok: true, value: parseDeclared(t) }; } catch (e) { return { ok: false, error: `${(e as Error).name}: ${(e as Error).message}` }; } };
const doc = (kind: string, body: string[], eol = "\n") => ["# c", "", "```" + kind, ...body, "```", ""].join(eol);

const rows: [string, string][] = [
  ["2a junk line", doc("qa-declared", ["[unrunnable]", "", "not an item", "A-1: x"])],
  ["2b item before header", doc("qa-declared", ["", "A-1: x", "", "[unrunnable]"])],
  ["2c id in both lists", doc("qa-declared", ["[unrunnable]", "A-1: x", "", "[out-of-scope]", "", "A-1: y"])],
  ["2d id twice in one list", doc("qa-declared", ["[unrunnable]", "A-1: x", " ", "A-1: y"])],
  ["2d' id twice, frozen", doc("qa-unrunnable", ["X-1: x", "\t", "X-1: y"])],
  ["2e two blocks", doc("qa-declared", ["[unrunnable]", "", "A-1: x"]) + doc("qa-unrunnable", ["", "X-1: y"])],
  ["2f header leading space", doc("qa-declared", ["", " [unrunnable]", "A-1: x"])],
  ["2f header leading tab", doc("qa-declared", ["\t[unrunnable]", "A-1: x"])],
  ["2f item leading space", doc("qa-declared", ["[unrunnable]", "", "  A-1: x"])],
  ["2f item leading tab, frozen", doc("qa-unrunnable", ["\tX-1: x"])],
  ["2f header in frozen", doc("qa-unrunnable", ["[unrunnable]", "", "X-1: x"])],
  ["2g NBSP U+00A0", doc("qa-declared", ["[unrunnable]", " ", "A-1: x"])],
  ["2g form feed \\f", doc("qa-declared", ["[unrunnable]", "\f", "A-1: x"])],
  ["2g vertical tab \\v", doc("qa-declared", ["[unrunnable]", "\v", "A-1: x"])],
  ["2g ZWSP U+200B", doc("qa-declared", ["[unrunnable]", "​", "A-1: x"])],
  ["2g BOM U+FEFF", doc("qa-declared", ["[unrunnable]", "﻿", "A-1: x"])],
  ["2g ideographic U+3000", doc("qa-declared", ["[unrunnable]", "　", "A-1: x"])],
  ["2g space+NBSP+tab", doc("qa-declared", ["[unrunnable]", "  \t", "A-1: x"])],
  ["3a blank-only qa-declared", doc("qa-declared", ["", " ", "\t", "\r"])],
  ["3a blank-only qa-declared CRLF", doc("qa-declared", ["", " \t"], "\r\n")],
  ["3b blank-only qa-unrunnable", doc("qa-unrunnable", [" ", "", "\t\r"])],
  ["3c empty body qa-declared", doc("qa-declared", [])],
  ["3d no block", "# c\n\nno fence here\n"],
  ["3e only a different fence", "# c\n\n```text\n\n```\n"],
];
for (const [name, text] of rows) console.log(JSON.stringify({ row: name, out: run(text) }));
const real = readFileSync(realPath!, "utf8");
console.log(JSON.stringify({ row: "4 real file", out: run(real) }));
