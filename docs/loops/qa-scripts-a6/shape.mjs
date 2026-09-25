// node shape.mjs <labelA> <labelB> [probe...] — QA 94. Structural comparison of probe15 records across trees.
// Normalises temp-dir suffixes, tokens and 16-hex hashes (random tokens make hashes differ run to run), then compares
// status/code/stage/failedMd, config verdicts (stage, ok, change kinds, unrestored count), machine findings (stage,
// scope, before/after SHAPE) and the findings text. Prints DIFF lines and a count of probes compared, so an empty diff
// can be told from "compared nothing".
import { readFileSync } from "node:fs";
const [A, B, ...only] = process.argv.slice(2);
const ja = JSON.parse(readFileSync(`p15-${A}.json`, "utf-8"));
const jb = JSON.parse(readFileSync(`p15-${B}.json`, "utf-8"));
const norm = (s) =>
  String(s)
    .replace(/C:\\\\?Users\\\\?melve\\\\?AppData\\\\?Local\\\\?Temp\\\\?/g, "%T%/")
    .replace(/qa\d+-[a-z]+(-[a-z]+)*-[A-Za-z0-9]{6}/g, "QADIR")
    .replace(/TOK[0-9a-f]+/g, "TOK")
    .replace(/\b[0-9a-f]{16}\b/g, "H16")
    .replace(/\b(dev|ino) \d+/g, "$1 N")
    .replace(/PID \d+|\d+ms/g, "N");
const shape = (R) => {
  if (!R) return "MISSING";
  const s = R.summary ?? R;
  const o = {
    thrown: s.thrown ? norm(s.thrown).slice(0, 200) : null,
    status: s.status ?? null, code: s.code ?? null, stage: s.stage ?? null, failedMd: s.failedMd ?? null,
    cv: (s.configVerdicts ?? []).map((v) => ({ st: v.stage, ok: v.ok, ch: (v.changes ?? []).map((c) => `${c.kind}:${norm(c.path).split(/[\\/]/).pop()}`), un: (v.unrestored ?? []).length })),
    mf: (s.machineFindings ?? []).map((f) => ({ st: f.stage, sc: f.scope, b: norm(f.before), a: norm(f.after) })),
    fi: (s.findings ?? []).map((f) => norm(f).slice(0, 260)),
    tokenInLR: s.tokenInLoopResult ?? null, tokenRepo: (s.tokenInRepo ?? []).length,
  };
  for (const k of Object.keys(R)) if (!["token", "summary", "byStage", "h0", "h1"].includes(k)) o[k] = norm(JSON.stringify(R[k]));
  return JSON.stringify(o);
};
const probes = (only.length ? only : Object.keys(ja)).filter((k) => k !== "tree" && k !== "at");
let diffs = 0;
for (const p of probes) {
  const x = shape(ja[p]), y = shape(jb[p]);
  if (x !== y) {
    diffs++;
    console.log(`DIFF ${p}\n  ${A}: ${x.slice(0, 1600)}\n  ${B}: ${y.slice(0, 1600)}`);
  }
}
console.log(`compared ${probes.length} probes ${A} vs ${B}: ${diffs} differ`);
