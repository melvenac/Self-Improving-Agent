// QA 144 (T-171): my own mutants, on the developer's machinery (../dev-scripts-t171/mutants-t171.cjs): every edit must
// match its anchor exactly once and land, `tsc --noEmit -p .` must exit 0 or the mutant is VOID, the named test files
// run through vitest's JSON reporter, and every mutated file is restored and hash-checked after each mutant.
// usage (from open-brain/):
//   node mutants-qa144.cjs <outdir> [id ...]   run locally
//   node mutants-qa144.cjs --apply <id>        mutate in place (for a qa/t171-mut-<id> branch)
const fs = require("fs");
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);

const W = "src/shared/state-writer.ts";
const SV = "src/server.ts";

// [id, what it breaks, [[file, from, to, count], ...]]
const M = [
  // dispatch 1: append_note implemented as replace, while the report still reads like an append.
  ["append-as-replace", "append_note REPLACES the note; the APPENDED line still carries the sizes an append would have",
    [[W, "  t.note = t.note ? `${t.note}${NOTE_JOIN}${add}` : add;\n  ctx.noteChanges.push(`${t.id} note APPENDED: +${t.note.length - before} chars (${before} -> ${t.note.length})`);\n",
         "  const after = t.note ? before + NOTE_JOIN.length + add.length : add.length;\n  t.note = add;\n  ctx.noteChanges.push(`${t.id} note APPENDED: +${after - before} chars (${before} -> ${after})`);\n", 1]]],
  // dispatch 2: the dry run silent — for the DESTRUCTIVE line only, at the door the agent reads.
  ["dry-run-hides-replace", "ob_state's dry run prints APPENDED/SET lines but drops every REPLACED line (the write still prints it)",
    [[SV, "    for (const c of r.note_changes) lines.push(`NOTE CHANGE: ${c}`);\n",
          "    for (const c of r.note_changes) if (!r.dry_run || !c.includes(\" REPLACED\")) lines.push(`NOTE CHANGE: ${c}`);\n", 1]]],
  // dispatch 3: note_by ignored for the override — any registered writer may replace any note unnamed.
  ["note-by-ignored", "the replace refusal never reads note_by: a registered writer owns every note; only an unregistered one is refused",
    [[W, "const others = old === \"\" ? [] : t.note_by === null ? null : t.note_by.filter((u) => u !== ctx.uuid);",
         "const others = old === \"\" ? [] : ctx.uuid === null ? null : ([] as string[]);", 1]]],
  // mine: the removal test by length — a longer replacement that drops the old text says nothing was removed.
  ["removes-by-length", "a replace counts as removing text only when the new note is SHORTER (a longer rewrite reports 'no text removed')",
    [[W, "const removes = old !== \"\" && !text.includes(old);", "const removes = old !== \"\" && text.length < old.length;", 1]]],
  // mine: appending to an unattributed note makes it the appender's.
  ["append-legacy-owned", "append_note to a note with no recorded author (null) keys it to the appender alone",
    [[W, "  if (prev === null) return null;\n  return prev.includes(uuid)", "  if (prev === null) return [uuid];\n  return prev.includes(uuid)", 1]]],
  // mine: a replace that removes nothing needs no flag, even on another session's note.
  ["superset-foreign-unflagged", "replacing another session's note with a superset of it needs no replace_other_sessions",
    [[W, "  if (foreign && !overrideOthers) {", "  if (foreign && !overrideOthers && removes) {", 1]]],
];

const TESTS = [
  "tests/shared/state-writer-notes.test.ts", "tests/shared/state-writer.test.ts", "tests/shared/state-schema.test.ts",
  "tests/shared/session-order.test.ts", "tests/pipelines/state-views.test.ts", "tests/server.test.ts",
  "tests/pipelines/state-import-v3.test.ts", "tests/pipelines/state-migrate.test.ts",
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

const FILES = [W, SV];
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
if (!outDir) { console.error("usage: node mutants-qa144.cjs <outdir> [id ...] | --apply <id>"); process.exit(2); }
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
  for (const f of (r.failed || []).slice(0, 6)) console.log(`    ${f.slice(0, 170)}`);
}
console.log(`restored: ${verifyRestored()}`);
