#!/usr/bin/env node
// QA 114 (T-183): clip() at its edges, and a seeded fuzz of the "never silent" invariant.
//
// The invariant (brief §2.1, Amendment 1): the result is EITHER the whole text (<= limit, one line)
// OR a one-line prefix of it, no longer than the limit, followed by exactly
// `… (<text.length> chars; full text: state.json <where>)`.
// The edges are reported as observed output, so a design reading can be argued from them.
//
// Usage: node clip-edges.mjs <open-brain-dir>
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const { clip } = await import(pathToFileURL(join(process.argv[2], "build", "pipelines", "session-start", "state-render.js")).href);

const inv = (text, limit, r) => {
  const marker = `… (${text.length} chars; full text: state.json W)`;
  if (r === text) return text.length <= limit && !/[\r\n]/.test(text) ? "" : "whole but over/multi-line";
  if (!r.endsWith(marker)) return "no exact marker";
  const cut = r.slice(0, -marker.length);
  if (!text.startsWith(cut)) return "cut not a prefix";
  if (cut.length > limit) return "cut over limit";
  if (/[\r\n]/.test(r)) return "result multi-line";
  return "";
};

const edges = {
  "exactly 140": "a".repeat(140),
  "141, no sentence end": "a".repeat(141),
  "short, trailing newline": "Short gap.\n",
  "short, CRLF inside": "First line\r\nsecond line",
  "starts with newline": "\nBody after a leading newline",
  "sentence at 1": "A. Then a long tail " + "x".repeat(150),
  "abbreviation e.g.": "Use e.g. the importer when the record is " + "long ".repeat(30),
  "version v0.39. then": "Seen at v0.39. The index was stale " + "y".repeat(120),
  "period at 140 then space": "b".repeat(139) + ". tail",
  "surrogate pair at the cut": "c".repeat(139) + "\u{1F600}" + "d".repeat(10),
  "sentence end then newline": "One. \nTwo",
  "ellipsis already in text": "Wait… this is " + "z".repeat(140),
  "empty": "",
  "tab only": "\t",
  "U+2028 line separator": "Line one line two",
};
const edgeOut = {};
for (const [k, t] of Object.entries(edges)) {
  const r = clip(t, 140, "W");
  edgeOut[k] = { in_len: t.length, out: r.length > 200 ? r.slice(0, 60) + " […] " + r.slice(-70) : r, invariant: inv(t, 140, r) || "holds" };
}

// Seeded fuzz: an alphabet weighted towards the characters the cut logic looks at.
let seed = 114;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const alpha = ["a", "b", " ", " ", ".", "!", "?", "\n", "\r", "\t", "…", "\u{1F600}", "é", "-", "(", ")"];
let runs = 0; const broke = [];
for (let i = 0; i < 200000; i++) {
  const len = Math.floor(rnd() * 320);
  let t = ""; for (let j = 0; j < len; j++) t += alpha[Math.floor(rnd() * alpha.length)];
  const limit = [100, 140, 1, 5][Math.floor(rnd() * 4)];
  const r = clip(t, limit, "W");
  runs++;
  const e = inv(t, limit, r);
  if (e && broke.length < 10) broke.push({ e, limit, t: JSON.stringify(t).slice(0, 120) });
}
console.log(JSON.stringify({ edges: edgeOut, fuzz: { runs, invariant_breaks: broke.length, examples: broke } }, null, 2));
