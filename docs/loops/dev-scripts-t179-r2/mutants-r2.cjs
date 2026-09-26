// T-179 round 2 (record 128): one mutant per protection. Same discipline as
// ../dev-scripts-t179-merge/mutants-v3.cjs: every edit must match exactly its stated
// count and land, `tsc --noEmit -p .` must exit 0 or the mutant does not count
// (VOID), the named test files run through vitest's JSON reporter, and every
// mutated file is restored and its hash checked after each mutant.
//
// usage (from open-brain/):
//   node ../docs/loops/dev-scripts-t179-r2/mutants-r2.cjs <outdir> [id ...]   run locally
//   node ../docs/loops/dev-scripts-t179-r2/mutants-r2.cjs --apply <id>        mutate in place (for a branch)
const fs = require("fs");
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);

const W = "src/shared/state-writer.ts";
const SCH = "src/shared/state-schema.ts";
const V = "src/pipelines/state-views/index.ts";
const ER = "src/pipelines/sync/record-erasure.ts";
const SV = "src/server.ts";
const HK = "../scripts/setup-hooks.mjs";

// The rule 3c0bfdc applied: "older than the record's newest NUMBER by more than 10".
const OLD_RULE = (arr, n) =>
  `new Set(${arr}.filter((e) => e.ref.${n} < Math.max(-1, ...s.sessions.map((x) => x.n)) - RECORD_RETENTION_SESSIONS && ${arr}.some((o) => o !== e && o.seat === e.seat && o.checkout === e.checkout && o.ref.${n} > e.ref.${n})).map((e) => e.ref))`;

// [id, protection, [[file, from, to, count], ...]]
const M = [
  ["ret-by-number", "R179-1 (Atlas): per-session retention restored to 3c0bfdc's NUMBER rule in the writer",
    [[W, "new Set(hAll.filter((e) => isSuperseded(e, hAll, revs, true)).map((e) => e.ref))", OLD_RULE("hAll", "session"), 1],
     [W, "new Set(sAll.filter((e) => isSuperseded(e, sAll, revs)).map((e) => e.ref))", OLD_RULE("sAll", "n"), 1]]],
  ["retention-infinite", "R179-1: the retention threshold raised to infinity (the brief's 'bound to infinity'; the amended rule has no number bound, so its one threshold)",
    [[W, "export const RECORD_RETENTION_SESSIONS = 10;", "export const RECORD_RETENTION_SESSIONS = Infinity;", 1]]],
  ["firstrev-from-caller", "R179-1: first_rev is the writer's revision, never the caller's session number",
    [[W, "const firstRev = mine?.first_rev ?? before + 1;", "const firstRev = mine?.first_rev ?? options.session;", 1]]],
  ["firstrev-restamp", "R179-1: a recorded session keeps its first_rev; a later write does not move it forward",
    [[W, "const firstRev = mine?.first_rev ?? before + 1;", "const firstRev = before + 1;", 1]]],
  ["last-by-number", "R179-1: lastSession() orders by first_rev, not n",
    [[SCH, "if (best === null || compareFirstRev(s.first_rev, best.first_rev) >= 0) best = s;", "if (best === null || s.n >= best.n) best = s;", 1]]],
  ["newest-by-number", "R179-1: the rendered newest handoff per (seat, checkout) is by first_rev, not session",
    [[SCH, "if (!cur || compareFirstRev(h.first_rev, cur.first_rev) >= 0) newest.set(key, h);", "if (!cur || h.session >= cur.session) newest.set(key, h);", 1]]],
  ["done-by-number", "done tasks (Atlas): retention restored to 'closed_session <= newest number - 3'",
    [[W, "const old = isDroppedByRetention(t, revs);", "const old = t.status === \"done\" && t.closed_session !== null && t.closed_session <= Math.max(-1, ...s.sessions.map((x) => x.n)) - DONE_RETENTION_SESSIONS;", 1]]],
  ["done-infinite", "done tasks: the 3-session threshold raised to infinity",
    [[V, "return since >= DONE_RETENTION_SESSIONS;", "return since >= Infinity;", 1]]],
  ["closed-rev-unset", "done tasks: close_task records closed_rev",
    [[W, "      t.closed_rev = ctx.rev;\n", "      void ctx.rev;\n", 1]]],
  ["legacy-never-yields", "R179-3: a legacy handoff is superseded by its seat's first keyed handoff",
    [[W, "return legacyYields && all.some((o) => o !== entry && o.seat === entry.seat && o.first_rev !== null);", "return false;", 1]]],
  ["legacy-yields-any-seat", "R179-3: ...by ITS OWN seat's keyed handoff only",
    [[W, "return legacyYields && all.some((o) => o !== entry && o.seat === entry.seat && o.first_rev !== null);", "return legacyYields && all.some((o) => o !== entry && o.first_rev !== null);", 1]]],
  ["legacy-session-yields", "R179-3: a legacy SESSION record is never superseded",
    [[W, "new Set(sAll.filter((e) => isSuperseded(e, sAll, revs)).map((e) => e.ref))", "new Set(sAll.filter((e) => isSuperseded(e, sAll, revs, true)).map((e) => e.ref))", 1]]],
  ["erasure-by-number", "T163-2 (Atlas): record-erasure explains a removal by 3c0bfdc's NUMBER rule",
    [[ER, "  return isSuperseded(entry, all, revs, r.kind === \"handoff\");\n", "  void revs; void all; void entry;\n  const nNewest = Math.max(-1, ...a.filter((x) => x.kind === \"session\").map((x) => x.session));\n  return r.session < nNewest - 10 && recs.some((x) => x.seat === r.seat && x.checkout === r.checkout && x.session > r.session);\n", 1]]],
  ["r1792-off", "R179-2: ob_set_session refuses another checkout's recorded session",
    [[SV, "if (rec && rec.checkout !== null && rec.checkout !== here) {", "if (rec && rec.checkout !== null && rec.checkout !== rec.checkout) {", 1]]],
  ["hooks-no-sessionend", "R179-5: setup.mjs registers SessionEnd",
    [[HK, "  ['SessionEnd', 'cli-session-end.js'],\n", "", 1]]],
  ["hooks-early-return", "R179-5: each event is checked on its own (the old early return)",
    [[HK, "      notes.push(`${event} hook already registered (${file})`);\n      continue;", "      notes.push(`${event} hook already registered (${file})`);\n      return { settings: s, changed: JSON.stringify(s) !== before, notes };", 1]]],
];

const TESTS = [
  "tests/shared/session-order.test.ts", "tests/pipelines/sync/record-erasure.test.ts", "tests/shared/closeout-erasure.test.ts",
  "tests/shared/state-writer.test.ts", "tests/shared/state-schema.test.ts", "tests/pipelines/state-views.test.ts",
  "tests/server.test.ts", "tests/setup-hooks.test.ts", "tests/pipelines/session-start/state-render.test.ts",
  "tests/pipelines/session-start/handoff-provenance.test.ts", "tests/pipelines/state-import-v3.test.ts", "tests/pipelines/state-migrate.test.ts",
];

function mutate(texts, edits) {
  const out = { ...texts };
  for (const [file, from, to, want] of edits) {
    const n = out[file].split(from).length - 1;
    if (n !== want) return { error: `${file}: anchor matched ${n} times, expected ${want}: ${JSON.stringify(from.slice(0, 70))}` };
    out[file] = out[file].split(from).join(to);
  }
  return { out };
}

const FILES = [W, SCH, V, ER, SV, HK];
const original = Object.fromEntries(FILES.map((f) => [f, fs.readFileSync(f, "utf8")]));
const restore = () => { for (const f of FILES) fs.writeFileSync(f, original[f]); };
const verifyRestored = () => FILES.every((f) => hash(fs.readFileSync(f)) === hash(Buffer.from(original[f])));

if (process.argv[2] === "--apply") {
  const m = M.find((x) => x[0] === process.argv[3]);
  if (!m) { console.error(`no mutant ${process.argv[3]}`); process.exit(2); }
  const r = mutate(original, m[2]);
  if (r.error) { console.error(`${m[0]}: VOID (${r.error})`); process.exit(1); }
  for (const f of FILES) if (r.out[f] !== original[f]) fs.writeFileSync(f, r.out[f]);
  if (!FILES.some((f) => fs.readFileSync(f, "utf8") !== original[f])) { console.error(`${m[0]}: edit did not land`); process.exit(1); }
  console.log(`${m[0]} applied`);
  process.exit(0);
}

const outDir = process.argv[2];
const only = process.argv.slice(3);
if (!outDir) { console.error("usage: node mutants-r2.cjs <outdir> [id ...] | --apply <id>"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const results = [];
try {
  for (const [id, what, edits] of M) {
    if (only.length && !only.includes(id)) continue;
    const r = mutate(original, edits);
    if (r.error) { results.push({ id, what, status: `VOID (${r.error})` }); continue; }
    for (const f of FILES) if (r.out[f] !== original[f]) fs.writeFileSync(f, r.out[f]);
    const landed = FILES.filter((f) => fs.readFileSync(f, "utf8") !== original[f]);
    if (landed.length === 0) { results.push({ id, what, status: "VOID (edit did not land)" }); restore(); continue; }
    const tsc = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "."], { encoding: "utf8" });
    if (tsc.status !== 0) { results.push({ id, what, status: `VOID (tsc exit ${tsc.status}: ${(tsc.stdout || "").split("\n")[0]})` }); restore(); continue; }
    const json = path.join(outDir, `${id}.json`);
    spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...TESTS, "--reporter=json", `--outputFile=${json}`], { encoding: "utf8" });
    restore();
    if (!verifyRestored()) throw new Error(`restore failed after ${id}`);
    let rep;
    try { rep = JSON.parse(fs.readFileSync(json, "utf8")); } catch { results.push({ id, what, status: "VOID (no vitest report)" }); continue; }
    const failed = rep.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => `${path.basename(f.name)} > ${a.fullName}`));
    results.push({ id, what, landed, status: failed.length ? `KILLED (${failed.length}/${rep.numTotalTests})` : `SURVIVED (0/${rep.numTotalTests})`, failed });
  }
} finally {
  restore();
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(results, null, 2));
for (const r of results) {
  console.log(`${r.status.padEnd(22)} ${r.id} — ${r.what}`);
  for (const f of (r.failed || []).slice(0, 4)) console.log(`    ${f.slice(0, 170)}`);
}
console.log(`restored: ${verifyRestored()}`);
