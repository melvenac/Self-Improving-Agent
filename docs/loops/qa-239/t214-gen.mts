// QA 239's own P-blank generator for T-214. Independent of the builder's t214-declared-blank.test.ts.
// Usage: tsx t214-gen.mts <candidate declared.ts> <base declared.ts> [out.json]
// Exit 0 only when every row agrees. Every disagreement is printed and counted.
//
// The oracle is the base parser itself: for any generated document x,
//   cand(x) must equal base(strip(x)), where strip removes the whitespace-only lines inside the block.
// That states P-blank (blank lines never change the result, ids in the same order) and "nothing else loosens"
// (on a document with no blank lines, candidate and base agree exactly, refusal message included) as one rule.
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";

const [candPath, basePath, outPath] = process.argv.slice(2);
const cand = await import(pathToFileURL(candPath!).href);
const base = await import(pathToFileURL(basePath!).href);

type Kind = "qa-declared" | "qa-unrunnable";
type Out = { ok: true; value: unknown } | { ok: false; error: string };
const run = (p: (t: string) => unknown, text: string): Out => {
  try { return { ok: true, value: p(text) }; }
  catch (e) { return { ok: false, error: `${(e as Error).name}: ${(e as Error).message}` }; }
};
const same = (a: Out, b: Out) => JSON.stringify(a) === JSON.stringify(b);

// Seeded PRNG (xorshift32, not the builder's mulberry32).
let s = 0x239_0214;
const rand = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

// Whitespace-only lines: "", spaces, tabs, a lone \r, and mixes (including \r not at the end).
const BLANKS = ["", " ", "   ", "\t", "\t\t", " \t ", "\r", " \r", "\t\r", "\r \t", "\r\r", " \t\r ", "\t \r\t"];
const isBlank = (l: string) => /^[ \t\r]*$/.test(l);

const doc = (kind: Kind, body: readonly string[], eol: string, pre = "# criteria", post = "after"): string =>
  [pre, "", "```" + kind, ...body, "```", post, ""].join(eol);

const VALID: { name: string; kind: Kind; body: string[] }[] = [
  { name: "D1 both", kind: "qa-declared", body: ["[unrunnable]", "Q-1: one", "Q-2: two", "[out-of-scope]", "Q-3: three"] },
  { name: "D2 oos first, colon in text", kind: "qa-declared", body: ["[out-of-scope]", "Z-9: x", "[unrunnable]", "A-1: y: with colon", "B-2 :spaced"] },
  { name: "D3 header repeated", kind: "qa-declared", body: ["[unrunnable]", "[unrunnable]", "Q-1: a", "[out-of-scope]", "[unrunnable]", "Q-2: b"] },
  { name: "D4 oos only", kind: "qa-declared", body: ["[out-of-scope]", "O-1: a", "O-2: b", "O-3: c"] },
  { name: "D5 real C body, blank removed", kind: "qa-declared", body: [
    "[unrunnable]", "CC-23: e2e", "CC-24: count", "CC-25: backfill", "[out-of-scope]", "CC-26: d", "CC-27: t", "CC-28: j", "CC-21: cut"] },
  { name: "D6 header alone", kind: "qa-declared", body: ["[unrunnable]"] },
  { name: "D7 empty", kind: "qa-declared", body: [] },
  { name: "D8 trailing space in text", kind: "qa-declared", body: ["[unrunnable]", "T-1: text  ", "T-2:\tx"] },
  { name: "U1 frozen", kind: "qa-unrunnable", body: ["U-1: a", "U-2: b", "U-3: c", "U-4: d"] },
  { name: "U2 frozen single, no space", kind: "qa-unrunnable", body: ["QA-1:x"] },
  { name: "U3 frozen empty", kind: "qa-unrunnable", body: [] },
];

const counts: Record<string, { n: number; bad: number }> = {};
const failures: { row: string; text: string; cand: Out; expect: Out }[] = [];
const check = (row: string, text: string, expect: Out, got: Out = run(cand.parseDeclared, text)) => {
  counts[row] ??= { n: 0, bad: 0 };
  counts[row].n++;
  if (!same(got, expect)) {
    counts[row].bad++;
    if (failures.length < 50) failures.push({ row, text, cand: got, expect });
  }
};

// G1: every valid block parses (sanity), and is not refused at the base either.
for (const v of VALID) for (const eol of ["\n", "\r\n"]) {
  const t = doc(v.kind, v.body, eol);
  const b = run(base.parseDeclared, t);
  if (!b.ok) throw new Error(`base refuses valid ${v.name}: ${b.error}`);
  check("G1 valid blocks equal at base and candidate", t, b);
}

// G2: exhaustive single insertion: every position 0..n (0 is directly after the opening fence, n is just
// before the closing fence), every blank kind, LF and CRLF. Expect the original's parse.
for (const v of VALID) for (const eol of ["\n", "\r\n"]) {
  const expect = run(base.parseDeclared, doc(v.kind, v.body, eol));
  for (let pos = 0; pos <= v.body.length; pos++) for (const b of BLANKS) {
    const body = [...v.body.slice(0, pos), b, ...v.body.slice(pos)];
    check(`G2 one blank at every position (${eol === "\n" ? "LF" : "CRLF"})`, doc(v.kind, body, eol), expect);
  }
}

// G3: random multi-insertion, 1..8 blanks, runs allowed, LF and CRLF, then removal back to the original.
for (let i = 0; i < 800; i++) {
  const v = pick(VALID);
  const eol = rand() < 0.5 ? "\n" : "\r\n";
  const body = [...v.body];
  const k = 1 + Math.floor(rand() * 8);
  for (let j = 0; j < k; j++) body.splice(Math.floor(rand() * (body.length + 1)), 0, pick(BLANKS));
  const expect = run(base.parseDeclared, doc(v.kind, v.body, eol));
  check("G3 random multi-blank insertion", doc(v.kind, body, eol), expect);
  // removal: dropping a random subset of the inserted blanks also changes nothing
  const fewer = body.filter((l) => !(isBlank(l) && rand() < 0.5));
  check("G3 random multi-blank insertion", doc(v.kind, fewer, eol), expect);
}

// G4: differential "nothing else loosens". Random bodies from a line alphabet that includes junk, refusals and
// non-ASCII spaces; blanks mixed in. Oracle: cand(x) == base(strip(x)). On blank-free bodies this is base == cand.
const NONBLANK = [
  "[unrunnable]", "[out-of-scope]", "A-1: a", "A-2: b", "B-1: c", "A-1: dup",
  "junk", "[bogus]", " [unrunnable]", "[unrunnable] ", "\t[out-of-scope]", " A-3: lead space", "\tA-4: lead tab",
  "A-5:", "9-x: digit", "- A-6: bullet", " ", "   ", "\f", "\v", "​", "﻿", "　", " ", "\u0085",
];
let refusedRandom = 0, parsedRandom = 0;
for (let i = 0; i < 3000; i++) {
  const kind: Kind = rand() < 0.7 ? "qa-declared" : "qa-unrunnable";
  const eol = rand() < 0.5 ? "\n" : "\r\n";
  const n = Math.floor(rand() * 7);
  const body: string[] = [];
  for (let j = 0; j < n; j++) body.push(rand() < 0.35 ? pick(BLANKS) : pick(NONBLANK));
  const stripped = body.filter((l) => !isBlank(l));
  const expect = run(base.parseDeclared, doc(kind, stripped, eol));
  const got = run(cand.parseDeclared, doc(kind, body, eol));
  if (got.ok) parsedRandom++; else refusedRandom++;
  check(body.some(isBlank) ? "G4 differential, with blanks" : "G4 differential, blank-free (base == cand)",
    doc(kind, body, eol), expect, got);
}

// G5: >= 50 one-junk-line variants of valid blocks with blanks around: candidate refuses, same message as base on
// the stripped body.
const JUNK = ["junk", "[bogus]", " [unrunnable]", "[unrunnable] ", " A-1: x", "\tA-1: x", "A-9:", "- A-6: b", " ", "\f", "\v", "​", "﻿"];
for (let i = 0; i < 300; i++) {
  const v = pick(VALID);
  const eol = rand() < 0.5 ? "\n" : "\r\n";
  const body = [...v.body];
  body.splice(Math.floor(rand() * (body.length + 1)), 0, pick(JUNK));
  for (let j = 0; j < 3; j++) body.splice(Math.floor(rand() * (body.length + 1)), 0, pick(BLANKS));
  const expect = run(base.parseDeclared, doc(v.kind, body.filter((l) => !isBlank(l)), eol));
  const got = run(cand.parseDeclared, doc(v.kind, body, eol));
  check("G5 one junk line + blanks still refused", doc(v.kind, body, eol), expect, got);
  if (got.ok) { counts["G5 one junk line + blanks still refused"]!.bad++; failures.push({ row: "G5 accepted junk", text: doc(v.kind, body, eol), cand: got, expect }); }
}

const total = Object.values(counts).reduce((a, c) => a + c.n, 0);
const bad = Object.values(counts).reduce((a, c) => a + c.bad, 0);
const summary = { total, bad, counts, g4: { parsed: parsedRandom, refused: refusedRandom }, failures };
for (const [k, c] of Object.entries(counts)) console.log(`${k}: ${c.n} variants, ${c.bad} disagreements`);
console.log(`G4 outcomes: ${parsedRandom} parsed, ${refusedRandom} refused`);
console.log(`TOTAL ${total} variants, ${bad} disagreements`);
for (const f of failures.slice(0, 8)) console.log("DISAGREE", f.row, JSON.stringify(f.text), JSON.stringify(f.cand), JSON.stringify(f.expect));
if (outPath) writeFileSync(outPath, JSON.stringify(summary, null, 2));
process.exit(bad === 0 ? 0 : 1);
