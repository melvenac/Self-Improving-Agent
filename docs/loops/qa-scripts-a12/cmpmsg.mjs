// node cmpmsg.mjs <a.json> <b.json> — QA 149: for tests failed in BOTH reports, compare the first LINE of the first failure message after
// normalising inode/dev numbers (5+ digits), 16-hex hashes and temp paths. Prints SAME/DIFF per test, NEW if only in b.
import { readFileSync } from "node:fs";
const BS = String.fromCharCode(92);
const norm = (s) =>
  s.split(BS + BS).join("/").split(BS).join("/")
    .replace(/C:\/qa-tmp\/[^"' ]+|\/tmp\/[^"' ]+|\/home\/[^"' ]+/g, "<TMP>")
    .replace(/\b[0-9a-f]{16}\b/g, "<H>")
    .replace(/\b\d{5,}\b/g, "<N>");
const key = (f, a) => `${f.name.split(BS).join("/").replace(/^.*tests\/harness\//, "")} > ${a.title.slice(0, 60)}`;
const load = (p) => {
  const j = JSON.parse(readFileSync(p, "utf8"));
  const m = new Map();
  for (const f of j.testResults) for (const a of f.assertionResults)
    if (a.status === "failed") m.set(key(f, a), norm((a.failureMessages[0] ?? "").split("\n")[0]));
  return m;
};
const a = load(process.argv[2]), b = load(process.argv[3]);
for (const [k, v] of b) {
  if (!a.has(k)) { console.log(`NEW   ${k}`); continue; }
  const same = a.get(k) === v;
  console.log(`${same ? "SAME" : "DIFF"}  ${k}${same ? "" : `\n   A: ${a.get(k).slice(0, 400)}\n   B: ${v.slice(0, 400)}`}`);
}
