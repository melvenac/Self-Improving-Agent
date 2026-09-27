// Round 4 mutants: one per protection (R4-1's block and its scope, R4-2's refusal, Q1's date match,
// Q17's order, O8, O10). Same method as round 3's mutants-r3.cjs: every edit must match exactly
// its stated count and land, `tsc --noEmit -p .` must exit 0 or the mutant does not count, then the
// importer test files run through vitest's JSON reporter and the red tests are listed. The source
// is restored and hashed after every mutant.
// usage (from open-brain/): node ../docs/loops/dev-scripts-importer-r4/mutants-r4.cjs <outdir> [id ...]
//        --apply <id>   applies one mutant to the working tree and exits (for the tcm branches)
const fs = require("fs");
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const SRC = "src/pipelines/state-import/index.ts";
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);

// R4-1 rewrote the line QA 106's M7, M8 and M9 anchor on, so they are VOID against this source.
// Their successors below make the same edits on the new line. M7's block is read from the source,
// as QA 106's `staleIf` is, so the edit moves the whole refusal rather than a copy of it.
const SRC_TEXT = fs.readFileSync(SRC, "utf8");
const bi = SRC_TEXT.indexOf("  if (stale.length + unreadable.length > 0 && opts.acceptStale !== true) {\n");
const staleIf = bi >= 0 ? SRC_TEXT.slice(bi, SRC_TEXT.indexOf("\n  }\n", bi) + 5) : "<<refusal block not found>>";

// [id, protection, [[from, to, count], ...]]
const M = [
  ["M7-r4", "QA 106's M7 on R4-1's line: the stale/unreadable refusal comes before the snapshot (moved below the snapshot's try/catch)",
    [[staleIf, "", 1], ["  const migrate = () => {\n", staleIf + "  const migrate = () => {\n", 1]]],
  ["M8-r4", "QA 106's M8 on R4-1's line: --commit re-judges and refuses",
    [["  if (stale.length + unreadable.length > 0 && opts.acceptStale !== true) {", "  if (false && stale.length + unreadable.length > 0 && opts.acceptStale !== true) {", 1]]],
  ["M9-r4", "QA 106's M9 on R4-1's line: --accept-stale lets --commit proceed",
    [["  if (stale.length + unreadable.length > 0 && opts.acceptStale !== true) {", "  if (stale.length + unreadable.length > 0) {", 1]]],
  ["R41-block", "R4-1: an unreadable input blocks a bare --commit",
    [["  unreadable: { blocks: true,", "  unreadable: { blocks: false,", 1]]],
  ["R41-scope", "R4-1's list: only the unreadable reason blocks; the other three could-not-tell reasons do not",
    [["  return i.verdict === \"could_not_tell\" && i.could_not_tell !== undefined && COULD_NOT_TELL[i.could_not_tell].blocks;", "  return i.verdict === \"could_not_tell\";", 1]]],
  ["R41-reason", "R4-1: the NUL verdict carries its reason, which is what blocks",
    [["evidence: undecodable[key]!, could_not_tell: \"unreadable\" });", "evidence: undecodable[key]! });", 1]]],
  ["R41-refusal", "R4-1: runCommit's refusal counts the unreadable inputs, not only the stale ones",
    [["  if (stale.length + unreadable.length > 0 && opts.acceptStale !== true) {", "  if (stale.length > 0 && opts.acceptStale !== true) {", 1]]],
  // QA 111's Q20 and QA 106's N5 are the same edit on this line; the anchor is theirs, byte for byte.
  ["R42-Q20", "R4-2: a SUMMARY.md with NUL bytes refuses --commit (index.ts:833; QA 111 Q20 = QA 106 N5)",
    [["  if (summaryRead?.undecodable) throw", "  if (summaryRead?.undecodable === \"never\") throw", 1]]],
  // QA 111's Q1 and Q17, their anchors byte for byte.
  ["Q1", "R4-3: a marker from ANY day refuses, not only today's",
    [["function refuseHalfRestored(root: string): void {", "function refuseHalfRestored(root: string, today = \"\"): void {", 1],
     ["n.startsWith(SNAPSHOT_PREFIX) && n.endsWith(INCOMPLETE_SUFFIX))", "n === `${SNAPSHOT_PREFIX}${today}${INCOMPLETE_SUFFIX}`)", 1],
     ["  refuseHalfRestored(root);\n", "  refuseHalfRestored(root, today);\n", 2]]],
  ["Q17", "R4-3: --draft reads the marker before state.json's own refusal",
    [["  refuseHalfRestored(root);\n  if (existsSync(join(root, STATE_REL))) throw new Error(`${STATE_REL} already exists — the importer runs once; nothing written`);\n  const draft =",
      "  if (existsSync(join(root, STATE_REL))) throw new Error(`${STATE_REL} already exists — the importer runs once; nothing written`);\n  refuseHalfRestored(root);\n  const draft =", 1]]],
  ["O8", "O8: the :833 refusal reads 'SUMMARY.md contains', not 'is contains'",
    [["`.agents/SYSTEM/SUMMARY.md ${summaryRead.undecodable}, and", "`.agents/SYSTEM/SUMMARY.md is ${summaryRead.undecodable}, and", 1]]],
  ["O10", "O10: the half-restored refusal says to keep a copy of the snapshot",
    [[". Keep a copy of the snapshot until the re-run completes: that re-run needs --force-snapshot, which deletes it on success`);", "`);", 1]]],
  ["O10-order", "O10: the added sentence comes after 'Nothing written', so the way out stays parseable (this seat's first placement)",
    [["then delete ${markers}. Nothing written. Keep a copy of the snapshot until the re-run completes: that re-run needs --force-snapshot, which deletes it on success`);",
      "then delete ${markers}. Keep a copy of the snapshot until the re-run completes: that re-run needs --force-snapshot, which deletes it on success. Nothing written`);", 1]]],
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
if (!outDir) { console.error("usage: node mutants-r4.cjs <outdir> [id ...] | --apply <id>"); process.exit(2); }
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
fs.writeFileSync(path.join(outDir, "mutants-r4.out"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
