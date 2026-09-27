// T-171 (record 140): one mutant per protection. Same machinery as
// ../dev-scripts-t179-r2/mutants-r2.cjs: every edit must match exactly its stated
// count and land, `tsc --noEmit -p .` must exit 0 or the mutant does not count
// (VOID), the named test files run through vitest's JSON reporter, and every
// mutated file is restored and its hash checked after each mutant.
//
// usage (from open-brain/):
//   node ../docs/loops/dev-scripts-t171/mutants-t171.cjs <outdir> [id ...]   run locally
//   node ../docs/loops/dev-scripts-t171/mutants-t171.cjs --apply <id>        mutate in place (for a branch)
const fs = require("fs");
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);

const W = "src/shared/state-writer.ts";
const SV = "src/server.ts";
const MG = "src/pipelines/state-migrate/index.ts";
const IM = "src/pipelines/state-import/index.ts";
const SCH = "src/shared/state-schema.ts";

// The pre-T-171 behaviour, restored for one op: `note` accepted and REPLACING.
const BARE_NOTE = (op) => [
  [W, `  ${op}: { note: `, `  ${op}_x: { note: `, 1],
  [W, `z.strictObject({ op: z.literal("${op}"), id: z.string(), ${op === "update_task" ? "title: z.string().min(1).optional(), priority: TaskPriority.optional(), status: ActiveStatus.optional(), " : ""}...NoteEdit }),`,
      `z.strictObject({ op: z.literal("${op}"), id: z.string(), ${op === "update_task" ? "title: z.string().min(1).optional(), priority: TaskPriority.optional(), status: ActiveStatus.optional(), " : ""}note: z.string().optional(), ...NoteEdit }),`, 1],
];

// [id, protection, [[file, from, to, count], ...]]
const M = [
  ["bare-note-update", "item 1 / the T-169 shape: update_task's `note` is refused, never a silent replace",
    [...BARE_NOTE("update_task"),
     [W, "      if (op.status !== undefined) t.status = op.status;\n      const refused = editNote(t, op, ctx);", "      if (op.status !== undefined) t.status = op.status;\n      if (op.note !== undefined) t.note = op.note;\n      const refused = editNote(t, op, ctx);", 1]]],
  ["bare-note-close", "item 3 / D4: close_task's `note` is refused, never a silent replace",
    [...BARE_NOTE("close_task"),
     [W, "      t.closed_rev = ctx.rev;\n      const refused = editNote(t, op, ctx);", "      t.closed_rev = ctx.rev;\n      if (op.note !== undefined) t.note = op.note;\n      const refused = editNote(t, op, ctx);", 1]]],
  ["append-unreported", "item 2: an append is reported with its size",
    [[W, "  ctx.noteChanges.push(`${t.id} note APPENDED: +${t.note.length - before} chars (${before} -> ${t.note.length})`);\n", "  void before;\n", 1]]],
  ["replace-no-first-line", "item 2: a replace that removes text prints the removed text's first line",
    [[W, "(removes ? `removed text begins: \"${firstLine}\"` : \"no text removed\")", "(removes ? `text removed (${firstLine.length > -1 ? \"\" : firstLine})` : \"no text removed\")", 1]]],
  ["replace-sizes-wrong", "item 2: a replace reports BOTH sizes",
    [[W, "note REPLACED: ${old.length} chars -> ${text.length} chars; ", "note REPLACED: ${text.length} chars; ", 1]]],
  ["dry-run-silent", "item 2: the DRY RUN reports note changes, not only the write",
    [[W, "    note_changes: noteChanges,\n", "    note_changes: dryRun ? [] : noteChanges,\n", 1]]],
  ["server-silent", "item 2: ob_state PRINTS each note change",
    [[SV, "    for (const c of r.note_changes) lines.push(`NOTE CHANGE: ${c}`);\n", "", 1]]],
  ["foreign-allowed", "item 4: another session's text is not replaced unnamed",
    [[W, "const foreign = others === null || others.length > 0;", "const foreign = others === null || others.length > 99;", 1]]],
  ["legacy-is-mine", "item 4: a note with no recorded author counts as another session's",
    [[W, "const foreign = others === null || others.length > 0;", "const foreign = others !== null && others.length > 0;", 1]]],
  ["unregistered-is-mine", "item 4: an unregistered write cannot prove any note is its own (its uuid filters out no author)",
    [[W, ": t.note_by.filter((u) => u !== ctx.uuid);", ": t.note_by.filter((u) => ctx.uuid !== null && u !== ctx.uuid);", 1]]],
  ["note-by-invariant-off", "item 4, schema: note_by is [] exactly when the note is empty (no authorless text)",
    [[SCH, "}).refine((t) => (t.note === \"\") === (t.note_by !== null && t.note_by.length === 0), {", "}).refine((t) => t.note === t.note || t.note_by === null, {", 1]]],
  ["replace-keeps-authors", "item 4: after a replace the note is the writer's alone",
    [[W, "  t.note_by = text === \"\" ? [] : ctx.uuid === null ? null : [ctx.uuid];\n", "", 1]]],
  ["append-unkeyed", "item 4: an append adds the writer to the note's authors",
    [[W, "  return prev.includes(uuid) ? prev : [...prev, uuid];\n", "  return prev;\n", 1]]],
  ["open-unkeyed", "item 4: open_task keys its note to the writer",
    [[W, "note_by: !op.note ? [] : ctx.uuid === null ? null : [ctx.uuid], closed_rev: null });", "note_by: [], closed_rev: null });", 1]]],
  ["both-fields", "item 1: append_note and replace_note together are refused",
    [[W, "  if (op.append_note !== undefined && op.replace_note !== undefined) {", "  if (false && op.append_note !== undefined && op.replace_note !== undefined) {", 1]]],
  ["migrate-owned", "item 4 on migration: a v2 note gets an UNKNOWN author, not none",
    [[MG, "note_by: t.note === \"\" ? [] : null", "note_by: []", 1]]],
  ["import-owned", "item 4 on import: an imported note gets an UNKNOWN author, not none",
    [[IM, "note_by: note === \"\" ? [] : null", "note_by: []", 1]]],
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

const FILES = [W, SV, MG, IM, SCH];
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
if (!outDir) { console.error("usage: node mutants-t171.cjs <outdir> [id ...] | --apply <id>"); process.exit(2); }
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
