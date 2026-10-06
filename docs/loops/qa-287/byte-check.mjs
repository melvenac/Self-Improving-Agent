// QA 287: the dry-run payload equals each input file's `request` field, byte for byte.
// Independent of the runner's slicer: walk the file's top-level object with a string-aware scanner,
// take the raw bytes of the value under key "request", and compare their sha256 with the record's
// subject.blob (the sha256 of the wire body the transport sends), plus deep-equal on the parsed value.
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const DIR = "C:/qa-tmp/qa287/dry-records";
const rl = JSON.parse(readFileSync("docs/loops/jev-calibration-2/runlist.json", "utf8"));
const recs = readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")));

function skipString(s, i) { // s[i] === '"'
  for (i++; i < s.length; i++) { if (s[i] === "\\") i++; else if (s[i] === '"') return i + 1; }
  throw new Error("unterminated string");
}
function valueEnd(s, i) {
  if (s[i] === '"') return skipString(s, i);
  if (s[i] === "{" || s[i] === "[") {
    let depth = 0;
    for (; i < s.length; i++) {
      const c = s[i];
      if (c === '"') { i = skipString(s, i) - 1; continue; }
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") { depth--; if (depth === 0) return i + 1; }
    }
    throw new Error("unbalanced");
  }
  let j = i; while (j < s.length && !/[,}\]\s]/.test(s[j])) j++; return j;
}
function topLevelRaw(s, key) {
  let i = s.indexOf("{") + 1;
  for (;;) {
    while (/[\s,]/.test(s[i])) i++;
    if (s[i] === "}") return null;
    const kEnd = skipString(s, i);
    const k = JSON.parse(s.slice(i, kEnd));
    i = kEnd; while (/[\s:]/.test(s[i])) i++;
    const vEnd = valueEnd(s, i);
    if (k === key) return s.slice(i, vEnd);
    i = vEnd;
  }
}
let pass = 0;
const rows = [];
for (const row of rl.phases.dev) {
  const file = readFileSync(row.input, "utf8");
  const raw = topLevelRaw(file, "request");
  const bytes = Buffer.from(raw, "utf8");
  const sha = createHash("sha256").update(bytes).digest("hex");
  const rec = recs.find((r) => r.dt?.path === row.input);
  const eqParsed = isDeepStrictEqual(JSON.parse(raw), JSON.parse(file).request);
  const eqRecord = rec && isDeepStrictEqual(rec.request, JSON.parse(file).request);
  const ok = rec && rec.subject.blob === sha && eqParsed && eqRecord;
  if (ok) pass++;
  rows.push({ case_id: row.case_id, bytes: bytes.length, sha, blob_equal: rec?.subject.blob === sha, request_deep_equal: !!eqRecord });
}
for (const r of rows) console.log(`${r.case_id}\t${r.bytes}\t${r.sha}\tblob_equal=${r.blob_equal}\tdeep_equal=${r.request_deep_equal}`);
console.log(`byte-check: ${pass}/${rl.phases.dev.length} rows: record subject.blob == sha256(file's request bytes) and request deep-equal`);
