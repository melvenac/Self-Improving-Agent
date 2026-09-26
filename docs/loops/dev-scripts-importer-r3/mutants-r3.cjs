// Round 3 mutants: one per protection. Each edit must match exactly once, tsc --noEmit must be
// clean, then the six importer test files run; the red tests are listed. The source is restored
// and hashed after every mutant.
// usage (from open-brain/): node mutants-r3.cjs <outdir> [id ...]
const fs = require("fs");
const { execFileSync, spawnSync } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const SRC = "src/pipelines/state-import/index.ts";
const outDir = process.argv[2];
const only = process.argv.slice(3);
fs.mkdirSync(outDir, { recursive: true });
const original = fs.readFileSync(SRC);
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);

const M = [
  // R3-1
  ["R31-path", "R3-1: the snapshot's catch removes what this run created (reverted to removal by path)",
    "    if (made.created) rmSync(made.created, { recursive: true, force: true });\n    if (aside) renameSync(aside, snapshotDir);\n    throw err;",
    "    rmSync(snapshotDir, { recursive: true, force: true });\n    if (aside) renameSync(aside, snapshotDir);\n    throw err;"],
  ["N13", "R3-1: the partial snapshot is removed at all (QA 106's N13, on this code)",
    "    if (made.created) rmSync(made.created, { recursive: true, force: true });\n    if (aside) renameSync(aside, snapshotDir);\n    throw err;",
    "    if (aside) renameSync(aside, snapshotDir);\n    throw err;"],
  ["R31-record", "R3-1: takeSnapshot records what it created",
    "  made.created = mkdirSync(dir, { recursive: true }) ?? null;", "  mkdirSync(dir, { recursive: true });"],
  ["R31-rollback", "R3-1: a completed rollback removes what this run created",
    "  if (created) rmSync(created, { recursive: true, force: true });\n  rmSync(marker, { force: true });\n  if (aside) renameSync(aside, snapshotDir);",
    "  rmSync(marker, { force: true });\n  if (aside) renameSync(aside, snapshotDir);"],
  // R3-2
  ["R32-fallback", "R3-2: invalid UTF-8 with no NUL is read as Windows-1252 (reverted to aba35de's undecodable)",
    '    if (!buf.includes(0)) return { text: decode1252(buf), encoding: "windows-1252", undecodable: null };\n    text = buf.toString("utf-8");',
    '    return { text: buf.toString("utf-8"), encoding, undecodable: "not valid UTF-8, and no UTF-16 byte-order mark: its encoding is unknown, so its words cannot be read" };'],
  ["R32-nul", "R3-2: NUL bytes still stop the fallback",
    '    if (!buf.includes(0)) return { text: decode1252(buf)', '    if (true) return { text: decode1252(buf)'],
  ["R32-table", "R3-2: 0x80-0x9F decode through the Windows-1252 table, not as Latin-1",
    '  for (const b of buf) s += b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : String.fromCharCode(b);',
    '  for (const b of buf) s += String.fromCharCode(b);'],
  ["R32-evidence", "R3-2: the evidence names the encoding",
    "    if (readAs[key]) i.evidence += ` (${readAs[key]})`;", "    void key;"],
  ["R32-summary", "R3-2: a Windows-1252 SUMMARY.md refuses --commit",
    '  if (summaryRead?.encoding === "windows-1252") throw', '  if (summaryRead?.encoding === "windows-1252" && false) throw'],
  // R3-3
  ["R33-draft", "R3-3: --draft refuses while the marker exists",
    "export function runDraft(projectRoot: string, today: string): DraftResult {\n  const root = resolve(projectRoot);\n  refuseHalfRestored(root);",
    "export function runDraft(projectRoot: string, today: string): DraftResult {\n  const root = resolve(projectRoot);"],
  ["R33-commit", "R3-3: --commit refuses while the marker exists (first, before state.json)",
    "  const root = resolve(projectRoot);\n  refuseHalfRestored(root);\n  const statePath", "  const root = resolve(projectRoot);\n  const statePath"],
  ["R33-write", "R3-3: the marker is written before any live change",
    '    writeFileSync(marker, incompleteNote(relative(root, snapshotDir).replace(/\\\\/g, "/")), "utf-8");\n', ""],
  ["R33-success", "R3-3: a completed commit removes the marker",
    "  rmSync(marker, { force: true });\n  if (aside) rmSync(aside", "  if (aside) rmSync(aside"],
  ["R33-rolledback", "R3-3: a completed rollback removes the marker",
    "  if (created) rmSync(created, { recursive: true, force: true });\n  rmSync(marker, { force: true });\n",
    "  if (created) rmSync(created, { recursive: true, force: true });\n"],
];

const results = [];
try {
  for (const [id, what, from, to] of M) {
    if (only.length && !only.includes(id)) continue;
    const src = original.toString("utf8");
    const n = src.split(from).length - 1;
    if (n !== 1) { results.push({ id, what, status: `VOID (anchor matched ${n} times)` }); continue; }
    const mutated = src.replace(from, to);
    fs.writeFileSync(SRC, mutated);
    if (fs.readFileSync(SRC, "utf8") !== mutated || mutated === src) throw new Error(`${id}: edit did not land`);
    fs.writeFileSync(path.join(outDir, `${id}.diff`), spawnSync("git", ["diff", "--", SRC], { encoding: "utf8" }).stdout);
    const tsc = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "."], { encoding: "utf8" });
    if (tsc.status !== 0) { results.push({ id, what, status: `TSC FAILED (${tsc.status}), not counted`, detail: tsc.stdout.slice(0, 400) }); }
    else {
      const json = path.join(outDir, `${id}.json`);
      const v = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/pipelines/state-import", "--reporter=json", `--outputFile=${json}`], { encoding: "utf8" });
      const r = JSON.parse(fs.readFileSync(json, "utf8"));
      const red = r.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => `${path.basename(f.name)} > ${a.title}`));
      const total = r.numTotalTests;
      results.push({ id, what, status: red.length ? `RED ${red.length}/${total}` : `SURVIVES 0/${total}`, vitest_exit: v.status, red });
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
fs.writeFileSync(path.join(outDir, "mutants-r3.out"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
