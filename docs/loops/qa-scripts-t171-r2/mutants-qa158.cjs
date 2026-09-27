// QA 158 (T-171 r2), from QA 144's mutants-qa144.cjs: QA 144's three survivors re-applied to a78a883, and QA 158's own.
// Originally: QA 144 (T-171): my own mutants, on the developer's machinery (../dev-scripts-t171/mutants-t171.cjs): every edit must
// match its anchor exactly once and land, `tsc --noEmit -p .` must exit 0 or the mutant is VOID, the named test files
// run through vitest's JSON reporter, and every mutated file is restored and hash-checked after each mutant.
// usage (from open-brain/):
//   node mutants-qa158.cjs <outdir> [id ...]   run locally
//   node mutants-qa158.cjs --apply <id>        mutate in place (for a qa/t171-mut-<id> branch)
const fs = require("fs");
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);

const W = "src/shared/state-writer.ts";
const SV = "src/server.ts";

// [id, what it breaks, [[file, from, to, count], ...]]
const M = [
  // ---- QA 144's three survivors, anchors unchanged (T171-D3) ----
  ["dry-run-hides-replace", "ob_state's dry run prints APPENDED/SET lines but drops every REPLACED line (the write still prints it)",
    [[SV, "    for (const c of r.note_changes) lines.push(`NOTE CHANGE: ${c}`);\n",
          "    for (const c of r.note_changes) if (!r.dry_run || !c.includes(\" REPLACED\")) lines.push(`NOTE CHANGE: ${c}`);\n", 1]]],
  ["removes-by-length", "a replace counts as removing text only when the new note is SHORTER (a longer rewrite reports 'no text removed')",
    [[W, "const removes = old !== \"\" && !text.includes(old);", "const removes = old !== \"\" && text.length < old.length;", 1]]],
  ["superset-foreign-unflagged", "replacing another session's note with a superset of it needs no replace_other_sessions",
    [[W, "  if (foreign && !overrideOthers) {", "  if (foreign && !overrideOthers && removes) {", 1]]],
  // ---- QA 158's own ----
  // D1: "removes nothing" judged as "starts with the old note": a PREPENDED superset drops the prior authors again.
  ["d1-superset-prefix-only", "a replace removes nothing only when the new note STARTS with the old one: a prepended superset resets note_by to the writer (D1 back)",
    [[W, "const removes = old !== \"\" && !text.includes(old);", "const removes = old !== \"\" && !text.startsWith(old);", 1]]],
  // D1: an unregistered writer's superset leaves the named authors in place, so they own text they did not write.
  ["d1-unregistered-superset-keeps", "an unregistered write's superset keeps note_by as it was (the unknown writer's text is credited to the named authors)",
    [[W, "removes ? (ctx.uuid === null ? null : [ctx.uuid]) : appendedBy(t.note_by, old, ctx.uuid);",
         "removes ? (ctx.uuid === null ? null : [ctx.uuid]) : ctx.uuid === null ? t.note_by : appendedBy(t.note_by, old, ctx.uuid);", 1]]],
  // D1: the same, restricted to a non-empty old note (the variant above is killed only through the empty-note path).
  ["d1-unregistered-superset-keeps-nonempty", "an unregistered write's superset of a NON-EMPTY note keeps note_by as it was (the unknown writer's text is credited to the named authors)",
    [[W, "removes ? (ctx.uuid === null ? null : [ctx.uuid]) : appendedBy(t.note_by, old, ctx.uuid);",
         "removes ? (ctx.uuid === null ? null : [ctx.uuid]) : ctx.uuid === null && old !== \"\" ? t.note_by : appendedBy(t.note_by, old, ctx.uuid);", 1]]],
  // D2: a line counts as kept only if the new note STARTS with it: a kept line after the first is quoted as removed.
  ["d2-kept-by-prefix", "the quote skips only old lines the new note starts with, so a kept later line is quoted as removed",
    [[W, ".find((ln) => !text.includes(ln))", ".find((ln) => !text.startsWith(ln))", 1]]],
  // D2: the LAST missing line instead of the first.
  ["d2-last-missing-line", "the REPLACED line quotes the LAST old line the new note lacks, not the first",
    [[W, "(old.split(/\\r?\\n/).find((ln) => !text.includes(ln))", "([...old.split(/\\r?\\n/)].reverse().find((ln) => !text.includes(ln))", 1]]],
  // D3 class: the dry run hides only the most destructive replace, the one that removes another session's text.
  ["dry-run-hides-foreign-replace", "ob_state's dry run drops a REPLACED line only when it removes another session's text (the write still prints it)",
    [[SV, "    for (const c of r.note_changes) lines.push(`NOTE CHANGE: ${c}`);\n",
          "    for (const c of r.note_changes) if (!r.dry_run || !c.includes(\"other session(s) removed\")) lines.push(`NOTE CHANGE: ${c}`);\n", 1]]],
  // D3 class: removal judged by the old note's first 120 chars: a long note truncated after them "removes nothing".
  ["removes-by-head", "a replace removes text only if the new note lacks the old note's first 120 chars: truncating a long note reports 'no text removed'",
    [[W, "const removes = old !== \"\" && !text.includes(old);", "const removes = old !== \"\" && !text.includes(old.slice(0, 120));", 1]]],
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
if (!outDir) { console.error("usage: node mutants-qa158.cjs <outdir> [id ...] | --apply <id>"); process.exit(2); }
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
