#!/usr/bin/env node
// QA 111's own round-3 mutants: protections the developer's mutants-r3.cjs does not target. Same method as theirs:
// every edit must match exactly its stated count and land, `tsc --noEmit -p .` must exit 0 or the mutant does not
// count, then the six importer test files run through vitest's JSON reporter, and the red tests are listed. The source
// is restored and hashed after every mutant, and again at the end.
// Usage (from <worktree>/open-brain): node mutants-r3-qa.mjs <outdir> [id ...]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";

const SRC = "src/pipelines/state-import/index.ts";
const [outDir, ...only] = process.argv.slice(2);
if (!outDir) { console.error("usage: node mutants-r3-qa.mjs <outdir> [id ...]"); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const original = readFileSync(SRC);
const hash = (b) => createHash("sha256").update(b).digest("hex").slice(0, 12);

// [id, protection, [[from, to, expectedCount], ...]]
const M = [
  ["Q1-marker-today-only", "R3-3: a marker from ANY day refuses, not only today's (no test uses another day's marker)", [
    ["function refuseHalfRestored(root: string): void {", "function refuseHalfRestored(root: string, today = \"\"): void {", 1],
    ["n.startsWith(SNAPSHOT_PREFIX) && n.endsWith(INCOMPLETE_SUFFIX))", "n === `${SNAPSHOT_PREFIX}${today}${INCOMPLETE_SUFFIX}`)", 1],
    ["  refuseHalfRestored(root);\n", "  refuseHalfRestored(root, today);\n", 2],
  ]],
  ["Q3-failed-rollback-drops-marker", "R3-3: a FAILED rollback keeps the marker", [
    ["    // The marker stays, so every later --draft and --commit refuses until it goes (D7).\n", "    rmSync(marker, { force: true });\n", 1],
  ]],
  ["Q6-evidence-stale-only", "R3-2: the Windows-1252 note is on every judged input, not only the STALE ones", [
    ["    if (readAs[key]) i.evidence +=", "    if (readAs[key] && i.verdict === \"stale\") i.evidence +=", 1],
  ]],
  ["Q8-snapshot-fail-no-aside", "R3-1: a failed snapshot puts the --force-snapshot aside back", [
    ["    if (made.created) rmSync(made.created, { recursive: true, force: true });\n    if (aside) renameSync(aside, snapshotDir);\n", "    if (made.created) rmSync(made.created, { recursive: true, force: true });\n", 1],
  ]],
  ["Q10-rollback-no-aside", "R2-3/R3-1: a completed rollback puts the --force-snapshot aside back", [
    ["  rmSync(marker, { force: true });\n  if (aside) renameSync(aside, snapshotDir);\n  return \"Rolled back", "  rmSync(marker, { force: true });\n  return \"Rolled back", 1],
  ]],
  ["Q13-valid-utf8-nul-judged", "the NUL rule for VALID UTF-8 (D8's site: a file with an appended UTF-16 line)", [
    ["  if (text.includes(\"\\u0000\")) return { text, encoding, undecodable:", "  if (text.includes(\"\\u0000\") && false) return { text, encoding, undecodable:", 1],
  ]],
  ["Q15-rollback-msg-no-marker", "R3-3: ROLLBACK FAILED says which marker to delete", [
    [". --draft and --commit refuse until ${marker} is deleted`;", "`;", 1],
  ]],
  ["Q16-created-is-snapshot", "R3-1: made.created is the FIRST directory created (archive/ when it was absent), not always the snapshot", [
    ["  made.created = mkdirSync(dir, { recursive: true }) ?? null;", "  mkdirSync(dir, { recursive: true }); made.created = dir;", 1],
  ]],
  ["Q17-draft-marker-after-state", "R3-3: --draft reads the marker before state.json's own refusal", [
    ["  refuseHalfRestored(root);\n  if (existsSync(join(root, STATE_REL))) throw new Error(`${STATE_REL} already exists — the importer runs once; nothing written`);\n  const draft =", "  if (existsSync(join(root, STATE_REL))) throw new Error(`${STATE_REL} already exists — the importer runs once; nothing written`);\n  refuseHalfRestored(root);\n  const draft =", 1],
  ]],
  ["Q18-draft-no-1252-note", "R3-2: --draft's report names the encoding too (buildImportDraft passes readAs)", [
    ["    staleness: detectStaleness(texts, last, undecodable, readAs),", "    staleness: detectStaleness(texts, last, undecodable),", 1],
  ]],
  ["Q20-nul-summary-refusal", "R2-1 on this code (QA 106's N5, over all six files): a SUMMARY.md with NUL bytes refuses --commit", [
    ["  if (summaryRead?.undecodable) throw", "  if (summaryRead?.undecodable === \"never\") throw", 1],
  ]],
  ["Q19-commit-no-1252-note", "R3-2: --commit's re-judgement passes readAs (evidence at commit)", [
    ["onDisk.undecodable, onDisk.readAs);", "onDisk.undecodable);", 1],
  ]],
];

const results = [];
try {
  for (const [id, what, edits] of M) {
    if (only.length && !only.includes(id)) continue;
    let src = original.toString("utf8");
    let voidWhy = null;
    for (const [from, to, want] of edits) {
      const n = src.split(from).length - 1;
      if (n !== want) { voidWhy = `anchor matched ${n} times, expected ${want}: ${JSON.stringify(from.slice(0, 60))}`; break; }
      src = src.split(from).join(to);
    }
    if (voidWhy) { results.push({ id, what, status: `VOID (${voidWhy})` }); continue; }
    writeFileSync(SRC, src);
    if (readFileSync(SRC, "utf8") !== src || src === original.toString("utf8")) throw new Error(`${id}: edit did not land`);
    writeFileSync(join(outDir, `${id}.diff`), spawnSync("git", ["diff", "--", SRC], { encoding: "utf8" }).stdout);
    const tsc = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "."], { encoding: "utf8" });
    if (tsc.status !== 0) results.push({ id, what, status: `TSC FAILED (${tsc.status}), not counted`, detail: tsc.stdout.slice(0, 400) });
    else {
      const json = join(outDir, `${id}.json`);
      const v = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/pipelines/state-import", "--reporter=json", `--outputFile=${json}`], { encoding: "utf8" });
      const r = JSON.parse(readFileSync(json, "utf8"));
      const red = r.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => `${basename(f.name)} > ${a.title}`));
      results.push({ id, what, status: red.length ? `RED ${red.length}/${r.numTotalTests}` : `SURVIVES 0/${r.numTotalTests}`, vitest_exit: v.status, red });
    }
    writeFileSync(SRC, original);
    if (hash(readFileSync(SRC)) !== hash(original)) throw new Error(`${id}: restore failed`);
  }
} finally {
  writeFileSync(SRC, original);
}
const lines = [`source ${SRC} sha256/12 ${hash(original)} (restored after every mutant; now ${hash(readFileSync(SRC))})`, ""];
for (const r of results) {
  lines.push(`${r.id}: ${r.status}${r.vitest_exit !== undefined ? ` (vitest exit ${r.vitest_exit})` : ""} — ${r.what}`);
  for (const t of r.red ?? []) lines.push(`    ${t}`);
  if (r.detail) lines.push(`    ${r.detail}`);
}
writeFileSync(join(outDir, "mutants-r3-qa.out"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
