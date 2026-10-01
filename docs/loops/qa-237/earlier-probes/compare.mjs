// QA 237: compare decisions of a re-run against the decisions the earlier QA recorded.
import { readFileSync } from "node:fs";
const D = "C:/qa-scratch/qa237-probes";
const TAG = process.argv[2] ?? "cand";
const j = (f) => {
  const t = readFileSync(f, "utf8");
  return JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
};
const dec = (v) => v?.decision ?? v?.got ?? (v?.exit !== undefined ? (v.exit === 0 ? "allow" : v.exit === 2 ? "deny" : `exit${v.exit}`) : JSON.stringify(v));
for (const [name, oldF, newF] of [
  ["QA233", `${D}/233-probe-out.json`, `${D}/out233-${TAG}.json`],
  ["QA234", `${D}/234-probe-cand-out.json`, `${D}/out234-${TAG}.txt`],
  ["QA234b", `${D}/234-probe2-cand-out.json`, `${D}/out234b-${TAG}.json`],
  ["QA235", `${D}/235-probe-cand-out.json`, `${D}/out235-${TAG}.json`],
]) {
  const a = j(oldF), b = j(newF);
  let same = 0;
  const diffs = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = dec(a[k]), y = dec(b[k]);
    if (x === y) same++;
    else diffs.push(`  ${k}: then=${x} now=${y}${b[k]?.reason ? ` | ${String(b[k].reason).slice(0, 160)}` : ""}`);
  }
  console.log(`${name}: ${same} same, ${diffs.length} differ`);
  for (const d of diffs) console.log(d);
}
