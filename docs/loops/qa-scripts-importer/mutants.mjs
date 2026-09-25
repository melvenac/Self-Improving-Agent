#!/usr/bin/env node
// QA 102, dispatch step 6: one mutant per protection, against the candidate's own tests.
// For each mutant: apply exact-string edits (each must match the stated number of times, or the mutant is VOID),
// save `git diff` as the proof of what it reverts, run `tsc --noEmit -p .` (src only, per tsconfig), then the three
// importer test files with the JSON reporter, and list every failing test. Restore the original bytes and compare
// sha256 before the next mutant; at the end `git status --porcelain` must be empty.
// No shell: execFileSync/spawnSync with argument arrays. Usage: node mutants.mjs <candidate-worktree> <out-dir>
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const [cand, out] = process.argv.slice(2).map((p) => resolve(p));
if (!cand || !out) { console.error("usage: node mutants.mjs <candidate> <out-dir>"); process.exit(2); }
mkdirSync(out, { recursive: true });
const ob = join(cand, "open-brain");
const IDX = "src/pipelines/state-import/index.ts", CLI = "src/cli.ts";
const TESTS = ["tests/pipelines/state-import.test.ts", "tests/pipelines/state-import-seeds.test.ts", "tests/pipelines/state-import-staleness.test.ts"];
const sha = (p) => createHash("sha256").update(readFileSync(join(ob, p))).digest("hex").slice(0, 12);
const orig = { [IDX]: readFileSync(join(ob, IDX), "utf8"), [CLI]: readFileSync(join(ob, CLI), "utf8") };
const origSha = { [IDX]: sha(IDX), [CLI]: sha(CLI) };
console.log(`original hashes: index.ts ${origSha[IDX]}, cli.ts ${origSha[CLI]}`);

// M1 needs master's real seed code, taken from 9bc06e3 rather than retyped.
const masterIdx = execFileSync("git", ["-C", cand, "show", `9bc06e3:open-brain/${IDX}`], { encoding: "utf8" });
const seedStart = masterIdx.indexOf("export function seedVerified");
const seedEnd = masterIdx.indexOf("\n}\n", masterIdx.indexOf("export function seedGaps")) + 3;
const seedCode = masterIdx.slice(seedStart, seedEnd);
if (seedStart < 0 || !seedCode.includes("G-006")) { console.error("could not extract master's seeds"); process.exit(2); }

const snapLine = "  const snapshot = takeSnapshot(root, today, opts.forceSnapshot === true);\n";
const staleBlockStart = "  // 0. T-180: a stale input refuses before anything is written, including the snapshot.\n";

const MUTANTS = [
  // --- the brief's IF-5 three, and the developer's M4/M5 (rebuilt from the handoff's description)
  { id: "M1", protection: "T-175: no seeds (IF-1)", expect: "IF-1 red", edits: [
    [IDX, "  const verified: Verified[] = [];\n  const gaps: Gap[] = [];\n", "  const verified: Verified[] = seedVerified();\n  const gaps: Gap[] = seedGaps();\n", 1],
    [IDX, "export type StalenessVerdict", seedCode + "\nexport type StalenessVerdict", 1]] },
  { id: "M2", protection: "T-180: the detector (IF-2)", expect: "IF-2 red", edits: [
    [IDX, 'verdict: d.n < latest.n ? "stale" : "current",', 'verdict: "current" as StalenessVerdict,', 1]] },
  { id: "M3", protection: "T-180: could-not-tell is never current (IF-4)", expect: "IF-4 red", edits: [
    [IDX, 'verdict: "could_not_tell",', 'verdict: "current",', 2]] },
  { id: "M4", protection: "ruling 1b: --commit prints the could-not-tell line", expect: "the --commit could-not-tell test red", edits: [
    [CLI, '    if (unknown.length) console.log(`Could not tell whether current: ${unknown.map((i) => i.input).join(", ")}`);\n', "", 1]] },
  { id: "M5", protection: "ruling 1a: a could-not-tell report line carries its reason", expect: "IF-4 report-line test red", edits: [
    [IDX, "L.push(`- ${label[v]} \\`${i.input}\\`: ${i.evidence}`);", "L.push(v === \"could_not_tell\" ? `- ${label[v]} \\`${i.input}\\`` : `- ${label[v]} \\`${i.input}\\`: ${i.evidence}`);", 1]] },
  // --- protections past the developer's five
  { id: "M6", protection: "T-150: an unrecognised flag refuses (the misspelled acknowledgement)", expect: "IF-2 CLI test red", edits: [
    [CLI, "  if (unknownFlags.length > 0) {", "  if (false && unknownFlags.length > 0) {", 1]] },
  { id: "M7", protection: "V-009 + T-180: the stale refusal comes before the snapshot", expect: "IF-2 no-archive assertion red", edits: [
    [IDX, snapLine, "", 1],
    [IDX, staleBlockStart, snapLine + staleBlockStart, 1],
    [IDX, "  // 1. Snapshot before anything under .agents/ changes.\n", "  // 1. (mutant M7: the snapshot moved above the stale check)\n", 1]] },
  { id: "M8", protection: "T-180: --commit re-judges and refuses on STALE", expect: "IF-2 refusal red", edits: [
    [IDX, "if (stale.length > 0 && opts.acceptStale !== true) {", "if (false && stale.length > 0 && opts.acceptStale !== true) {", 1]] },
  { id: "M9", protection: "T-180: --accept-stale lets --commit proceed", expect: "IF-2 proceeds-with-ack red", edits: [
    [IDX, "if (stale.length > 0 && opts.acceptStale !== true) {", "if (stale.length > 0) {", 1]] },
  { id: "M10", protection: "T-180: the staleness section is the report's FIRST section", expect: "IF-2 first-section red", edits: [
    [IDX, "  L.push(...renderStaleness(r.staleness), \"\");\n", "", 1],
    [IDX, "  L.push(\"## Sources\", \"\");", "  L.push(\"## Sources\", \"\");\n  L.push(...renderStaleness(r.staleness), \"\");", 1]] },
  { id: "M11", protection: "T-180: a STALE line carries its evidence", expect: "IF-2 evidence assertion red", edits: [
    [IDX, "L.push(`- ${label[v]} \\`${i.input}\\`: ${i.evidence}`);", "L.push(v === \"stale\" ? `- ${label[v]} \\`${i.input}\\`` : `- ${label[v]} \\`${i.input}\\`: ${i.evidence}`);", 1]] },
  { id: "M12", protection: "T-180: stale means one session behind, not two", expect: "IF-2 red", edits: [
    [IDX, 'verdict: d.n < latest.n ? "stale" : "current",', 'verdict: d.n < latest.n - 1 ? "stale" : "current",', 1]] },
  { id: "M13", protection: "CLI: --accept-stale is refused with --draft", expect: "unknown: no test names it", edits: [
    [CLI, "  if (!commit && args.includes(ACCEPT_STALE_FLAG)) {", "  if (false && !commit && args.includes(ACCEPT_STALE_FLAG)) {", 1]] },
  { id: "M14", protection: "CLI: --commit names what it imported STALE", expect: "unknown: no test reads that line", edits: [
    [CLI, "    if (r.accepted_stale.length) console.log(`Imported STALE under ${ACCEPT_STALE_FLAG}: ${r.accepted_stale.join(\", \")}`);\n", "", 1]] },
  { id: "M15", protection: "CLI: the --draft summary names stale and could-not-tell inputs", expect: "unknown: no test reads that line", edits: [
    [CLI, "      console.log(`Staleness: ", "      if (false) console.log(`Staleness: ", 1]] },
  { id: "M16", protection: "detector reads headings, not only the status blockquote", expect: "unknown: the tests' markers are all blockquotes", edits: [
    [IDX, "  lines.forEach((l, i) => { if (/^#{1,6} /.test(l)) candidates.push(i); });\n", "", 1]] },
];

function count(hay, needle) { let n = 0, i = 0; while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; } return n; }
function restore() { for (const f of [IDX, CLI]) writeFileSync(join(ob, f), orig[f]); for (const f of [IDX, CLI]) if (sha(f) !== origSha[f]) throw new Error(`restore failed for ${f}`); }

const summary = [];
for (const m of MUTANTS) {
  restore();
  const text = { [IDX]: orig[IDX], [CLI]: orig[CLI] };
  let voidWhy = "";
  for (const [f, from, to, n] of m.edits) {
    const c = count(text[f], from);
    if (c !== n) { voidWhy = `edit in ${f} matched ${c} times, expected ${n}: ${JSON.stringify(from.slice(0, 60))}`; break; }
    text[f] = text[f].split(from).join(to);
  }
  if (voidWhy) { console.log(`VOID ${m.id}: ${voidWhy}`); summary.push({ id: m.id, protection: m.protection, void: voidWhy }); continue; }
  for (const f of [IDX, CLI]) writeFileSync(join(ob, f), text[f]);
  const diff = execFileSync("git", ["-C", cand, "diff", "--", `open-brain/${IDX}`, `open-brain/${CLI}`], { encoding: "utf8" });
  writeFileSync(join(out, `${m.id}.diff`), diff);
  const stat = execFileSync("git", ["-C", cand, "diff", "--numstat", "--", `open-brain/${IDX}`, `open-brain/${CLI}`], { encoding: "utf8" }).trim().replace(/\n/g, "; ");
  const tsc = spawnSync(process.execPath, [join(ob, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", "."], { cwd: ob, encoding: "utf8" });
  const jsonOut = join(out, `${m.id}.vitest.json`);
  if (existsSync(jsonOut)) rmSync(jsonOut);
  const vt = spawnSync(process.execPath, [join(ob, "node_modules/vitest/vitest.mjs"), "run", ...TESTS, "--reporter=json", `--outputFile=${jsonOut}`], { cwd: ob, encoding: "utf8" });
  let failed = [], total = 0;
  if (existsSync(jsonOut)) {
    const j = JSON.parse(readFileSync(jsonOut, "utf8"));
    total = j.numTotalTests;
    for (const tf of j.testResults) for (const a of tf.assertionResults) if (a.status !== "passed") failed.push(`${tf.name.split(/[\\/]/).pop()} :: ${a.fullName}`);
  }
  restore();
  const line = `${m.id} [${m.protection}] diff ${stat} | tsc exit ${tsc.status}${tsc.status ? " " + (tsc.stdout + tsc.stderr).trim().split("\n")[0] : ""} | vitest exit ${vt.status} | red ${failed.length}/${total} | expected: ${m.expect}`;
  console.log(line);
  for (const f of failed) console.log(`    red: ${f}`);
  summary.push({ id: m.id, protection: m.protection, numstat: stat, tsc: tsc.status, vitest: vt.status, red: failed.length, total, failed, expect: m.expect });
}
restore();
const porcelain = execFileSync("git", ["-C", cand, "status", "--porcelain"], { encoding: "utf8" }).trim();
console.log(`restored: index.ts ${sha(IDX)} cli.ts ${sha(CLI)} (original ${origSha[IDX]} / ${origSha[CLI]}); git status --porcelain: ${porcelain === "" ? "clean" : porcelain}`);
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
