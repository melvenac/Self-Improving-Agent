// node cmpj9.mjs <prefix> A B — QA 104: field-by-field diff of two probe JSON outputs (p2, r57, r59, r62), after the
// shapev9 normalisations (temp dirs, tokens, hashes, dev/ino/size/mtime, PIDs, ms, SHAs). Prints each differing leaf.
import { readFileSync } from "node:fs";
const [p, A, B] = process.argv.slice(2);
const norm = (s) => String(s)
  .replace(/C:(\\|\|\/)+Users(\\|\|\/)+(AARONM~1|Aaron Melven)(\\|\|\/)+AppData(\\|\|\/)+Local(\\|\|\/)+Temp(\\|\|\/)+/g, "%T%/")
  .replace(/stage start /g, "").replace(/type (file|dir|absent|other|symlink) (?=dev )/g, "")
  .replace(/\b(size|mtimeNs) \d+/g, "$1 N").replace(/qa\d+-[a-z0-9]+(-[a-z0-9]+)*-[A-Za-z0-9]{6}/g, "QADIR")
  .replace(/TOK[0-9a-f]+/g, "TOK").replace(/\b[0-9a-f]{40}\b/g, "SHA").replace(/\b[0-9a-f]{16}\b/g, "H16")
  .replace(/\b(dev|ino) \d+/g, "$1 N").replace(/PID \d+|\d+ms|"durationMs":\d+/g, "N").replace(/\b[0-9a-f]{7,12}\b/g, "SHORT");
const a = JSON.parse(readFileSync(`${p}-${A}.json`, "utf-8")), b = JSON.parse(readFileSync(`${p}-${B}.json`, "utf-8"));
let n = 0, d = 0;
const walk = (x, y, path) => {
  if (x && typeof x === "object" && y && typeof y === "object") { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], `${path}.${k}`); return; }
  n++; const nx = norm(JSON.stringify(x)), ny = norm(JSON.stringify(y));
  if (nx !== ny) { d++; console.log(`DIFF ${path}\n  ${A}: ${nx.slice(0, 400)}\n  ${B}: ${ny.slice(0, 400)}`); }
};
walk(a, b, p);
console.log(`${p}: ${n} leaves compared, ${d} differ`);
