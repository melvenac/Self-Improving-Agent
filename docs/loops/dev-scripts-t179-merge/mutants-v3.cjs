// T-179 merge round: mutants for the importer's schema v3 output (state-import-v3.test.ts) and for
// the merge's own resolution line. Driver copied from ../dev-scripts-importer-r4/mutants-r4.cjs
// (lines 58 onward byte for byte, apart from the output file name): every edit must match exactly
// its stated count and land, `tsc --noEmit -p .` must exit 0 or the mutant does not count, the
// importer test files run through vitest's JSON reporter, and the source is restored and hashed
// after every mutant.
// usage (from open-brain/): node ../docs/loops/dev-scripts-t179-merge/mutants-v3.cjs <outdir> [id ...]
const fs = require("fs");
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const SRC = "src/pipelines/state-import/index.ts";
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);

// [id, protection, [[from, to, count], ...]]
const M = [
  ["v3-stamp", "the imported handoff is legacy: the importer never stamps a session_uuid on prose an earlier session wrote",
    [["loop_state: null, session_uuid: null, checkout: null };", "loop_state: null, session_uuid: \"imported\", checkout: null };", 1]]],
  ["v3-session-seat", "sessions[0] from the prose log records no seat the log never named",
    [["sessions: [{ n: last.n, date: last.date, uuid: last.uuid, seat: null, checkout: null }],", "sessions: [{ n: last.n, date: last.date, uuid: last.uuid, seat: \"developer\", checkout: null }],", 1]]],
  ["v3-shape", "--commit writes the record at schema v3 (a v2-shaped write is what master's importer did)",
    [["    writeFileSync(statePath, serializeState(parsed.data), \"utf-8\");", "    writeFileSync(statePath, JSON.stringify({ ...parsed.data, schema_version: 2 }, null, 2), \"utf-8\");", 1]]],
  // EQUIVALENT (see the handoff): an empty batch skips ops, retention and the write, and no renderer
  // reads `session`. Kept so the run shows it survives rather than leaving it out.
  ["merge-render-session", "the merge's resolution line: the render after commit is stamped with the imported last session, not 0",
    [["session: lastSession(parsed.data)?.n ?? 0, expected_revision: 0", "session: 0, expected_revision: 0", 1]]],
];

function mutate(src, edits) {
  for (const [from, to, want] of edits) {
    const n = src.split(from).length - 1;
    if (n !== want) return { error: `anchor matched ${n} times, expected ${want}: ${JSON.stringify(from.slice(0, 70))}` };
    src = src.split(from).join(to);
  }
  return { src };
}

const original = fs.readFileSync(SRC);
if (process.argv[2] === "--apply") {
  const m = M.find((x) => x[0] === process.argv[3]);
  if (!m) { console.error(`no mutant ${process.argv[3]}`); process.exit(2); }
  const r = mutate(original.toString("utf8"), m[2]);
  if (r.error) { console.error(`${m[0]}: VOID (${r.error})`); process.exit(1); }
  fs.writeFileSync(SRC, r.src);
  if (fs.readFileSync(SRC, "utf8") !== r.src || r.src === original.toString("utf8")) { console.error(`${m[0]}: edit did not land`); process.exit(1); }
  console.log(`${m[0]} applied to ${SRC}`);
  process.exit(0);
}

const outDir = process.argv[2];
const only = process.argv.slice(3);
if (!outDir) { console.error("usage: node mutants-v3.cjs <outdir> [id ...] | --apply <id>"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const results = [];
try {
  for (const [id, what, edits] of M) {
    if (only.length && !only.includes(id)) continue;
    const r = mutate(original.toString("utf8"), edits);
    if (r.error) { results.push({ id, what, status: `VOID (${r.error})` }); continue; }
    fs.writeFileSync(SRC, r.src);
    if (fs.readFileSync(SRC, "utf8") !== r.src || r.src === original.toString("utf8")) throw new Error(`${id}: edit did not land`);
    fs.writeFileSync(path.join(outDir, `${id}.diff`), spawnSync("git", ["diff", "--", SRC], { encoding: "utf8" }).stdout);
    const tsc = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "."], { encoding: "utf8" });
    if (tsc.status !== 0) results.push({ id, what, status: `TSC FAILED (${tsc.status}), not counted`, detail: tsc.stdout.slice(0, 400) });
    else {
      const json = path.join(outDir, `${id}.json`);
      const v = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/pipelines/state-import", "--reporter=json", `--outputFile=${json}`], { encoding: "utf8" });
      const j = JSON.parse(fs.readFileSync(json, "utf8"));
      const red = j.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => `${path.basename(f.name)} > ${a.title}`));
      results.push({ id, what, status: red.length ? `RED ${red.length}/${j.numTotalTests}` : `SURVIVES 0/${j.numTotalTests}`, vitest_exit: v.status, red });
    }
    fs.writeFileSync(SRC, original);
    if (hash(fs.readFileSync(SRC)) !== hash(original)) throw new Error(`${id}: restore failed`);
  }
} finally {
  fs.writeFileSync(SRC, original);
}
const lines = [`source ${SRC} sha256/12 ${hash(original)} (restored after every mutant)`, ""];
for (const r of results) {
  lines.push(`${r.id}: ${r.status}${r.vitest_exit !== undefined ? ` (vitest exit ${r.vitest_exit})` : ""} — ${r.what}`);
  for (const t of r.red ?? []) lines.push(`    ${t}`);
  if (r.detail) lines.push(`    ${r.detail}`);
}
fs.writeFileSync(path.join(outDir, "mutants-v3.out"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
