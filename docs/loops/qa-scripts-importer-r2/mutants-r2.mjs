#!/usr/bin/env node
// QA 106: IF-13. QA 102's mutant set re-applied to aba35de (M3 and M7 re-anchored, because the code they edit moved),
// plus one mutant per round-2 protection (N-series, rebuilt from the developer's handoff, which describes them but
// whose script is not on this PC), plus four of mine on the rollback itself (R-series).
// Method as QA 102's: each exact-string edit must match the stated number of times or the mutant is VOID; the `git
// diff` is saved as proof of what it reverts; `tsc --noEmit -p .` (src only); then ALL FIVE importer test files with
// the JSON reporter; restore and compare sha256; `git status --porcelain` clean at the end.
// No shell. Usage: node mutants-r2.mjs <candidate-worktree> <out-dir>
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const [cand, out] = process.argv.slice(2).map((p) => resolve(p));
if (!cand || !out) { console.error("usage: node mutants-r2.mjs <candidate> <out-dir>"); process.exit(2); }
mkdirSync(out, { recursive: true });
const ob = join(cand, "open-brain");
const IDX = "src/pipelines/state-import/index.ts", CLI = "src/cli.ts";
const TESTS = ["state-import.test.ts", "state-import-seeds.test.ts", "state-import-staleness.test.ts", "state-import-r2.test.ts", "state-import-atomic.test.ts"].map((f) => `tests/pipelines/${f}`);
const sha = (p) => createHash("sha256").update(readFileSync(join(ob, p))).digest("hex").slice(0, 12);
const orig = { [IDX]: readFileSync(join(ob, IDX), "utf8"), [CLI]: readFileSync(join(ob, CLI), "utf8") };
const origSha = { [IDX]: sha(IDX), [CLI]: sha(CLI) };
console.log(`original hashes: index.ts ${origSha[IDX]}, cli.ts ${origSha[CLI]}; HEAD ${execFileSync("git", ["-C", cand, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim()}`);

const masterIdx = execFileSync("git", ["-C", cand, "show", `9bc06e3:open-brain/${IDX}`], { encoding: "utf8" });
const seedStart = masterIdx.indexOf("export function seedVerified");
const seedEnd = masterIdx.indexOf("\n}\n", masterIdx.indexOf("export function seedGaps")) + 3;
const seedCode = masterIdx.slice(seedStart, seedEnd);
if (seedStart < 0 || !seedCode.includes("G-006")) { console.error("could not extract master's seeds"); process.exit(2); }

const staleIf = "  if (stale.length > 0 && opts.acceptStale !== true) {\n    const list = stale.map((i) => `${i.input} declares Session ${i.declared_session}`).join(\"; \");\n    throw new Error(`${stale.length} input(s) predate the latest session (Session ${staleness.latest!.n}): ${list}. Nothing written. Update them and re-run --draft, or pass ${ACCEPT_STALE_FLAG} to import them as they stand`);\n  }\n";

const MUTANTS = [
  // ---- QA 102's set
  { id: "M1", protection: "T-175: no seeds (IF-1)", edits: [
    [IDX, "  const verified: Verified[] = [];\n  const gaps: Gap[] = [];\n", "  const verified: Verified[] = seedVerified();\n  const gaps: Gap[] = seedGaps();\n", 1],
    [IDX, "export type StalenessVerdict", seedCode + "\nexport type StalenessVerdict", 1]] },
  { id: "M2", protection: "T-180: the detector (IF-2)", edits: [[IDX, 'verdict: d.n < latest.n ? "stale" : "current",', 'verdict: "current" as StalenessVerdict,', 1]] },
  { id: "M3", protection: "T-180: could-not-tell is never current (IF-4); re-anchored on round 1's two pushes", edits: [
    [IDX, 'inputs.push({ input, verdict: "could_not_tell", declared_session: declaredSession(text)?.n ?? null,', 'inputs.push({ input, verdict: "current", declared_session: declaredSession(text)?.n ?? null,', 1],
    [IDX, 'inputs.push({ input, verdict: "could_not_tell", declared_session: null, evidence: "names no', 'inputs.push({ input, verdict: "current", declared_session: null, evidence: "names no', 1]] },
  { id: "M4", protection: "ruling 1b: --commit prints the could-not-tell line", edits: [[CLI, '    if (unknown.length) console.log(`Could not tell whether current: ${unknown.map((i) => i.input).join(", ")}`);\n', "", 1]] },
  { id: "M5", protection: "ruling 1a: a could-not-tell line carries its reason", edits: [[IDX, "L.push(`- ${label[v]} \\`${i.input}\\`: ${i.evidence}`);", "L.push(v === \"could_not_tell\" ? `- ${label[v]} \\`${i.input}\\`` : `- ${label[v]} \\`${i.input}\\`: ${i.evidence}`);", 1]] },
  { id: "M6", protection: "T-150: an unrecognised flag refuses", edits: [[CLI, "  if (unknownFlags.length > 0) {", "  if (false && unknownFlags.length > 0) {", 1]] },
  { id: "M7", protection: "V-009 + T-180: the stale refusal comes before the snapshot; re-anchored (moved below the snapshot's try/catch)", edits: [
    [IDX, staleIf, "", 1],
    [IDX, "  const migrate = () => {\n", staleIf + "  const migrate = () => {\n", 1]] },
  { id: "M8", protection: "T-180: --commit re-judges and refuses on STALE", edits: [[IDX, "if (stale.length > 0 && opts.acceptStale !== true) {", "if (false && stale.length > 0 && opts.acceptStale !== true) {", 1]] },
  { id: "M9", protection: "T-180: --accept-stale lets --commit proceed", edits: [[IDX, "if (stale.length > 0 && opts.acceptStale !== true) {", "if (stale.length > 0) {", 1]] },
  { id: "M10", protection: "T-180: the staleness section is FIRST", edits: [
    [IDX, "  L.push(...renderStaleness(r.staleness), \"\");\n", "", 1],
    [IDX, "  L.push(\"## Sources\", \"\");", "  L.push(\"## Sources\", \"\");\n  L.push(...renderStaleness(r.staleness), \"\");", 1]] },
  { id: "M11", protection: "T-180: a STALE line carries its evidence", edits: [[IDX, "L.push(`- ${label[v]} \\`${i.input}\\`: ${i.evidence}`);", "L.push(v === \"stale\" ? `- ${label[v]} \\`${i.input}\\`` : `- ${label[v]} \\`${i.input}\\`: ${i.evidence}`);", 1]] },
  { id: "M12", protection: "T-180: one session behind is stale", edits: [[IDX, 'verdict: d.n < latest.n ? "stale" : "current",', 'verdict: d.n < latest.n - 1 ? "stale" : "current",', 1]] },
  { id: "M13", protection: "CLI: --accept-stale refused with --draft", edits: [[CLI, "  if (!commit && args.includes(ACCEPT_STALE_FLAG)) {", "  if (false && !commit && args.includes(ACCEPT_STALE_FLAG)) {", 1]] },
  { id: "M14", protection: "CLI: --commit names what it imported STALE", edits: [[CLI, "    if (r.accepted_stale.length) console.log(`Imported STALE under ${ACCEPT_STALE_FLAG}: ${r.accepted_stale.join(\", \")}`);\n", "", 1]] },
  { id: "M15", protection: "CLI: the --draft Staleness: summary", edits: [[CLI, "      console.log(`Staleness: ", "      if (false) console.log(`Staleness: ", 1]] },
  { id: "M16", protection: "the detector reads headings", edits: [[IDX, "  lines.forEach((l, i) => { if (/^#{1,6} /.test(l)) candidates.push(i); });\n", "", 1]] },
  // ---- one per round-2 protection (the developer's N1..N17, rebuilt from the handoff's descriptions)
  { id: "N1", protection: "R2-1: the UTF-8 BOM strip", edits: [[IDX, "  if (buf.length >= 3 && buf[0] === 0xef", "  if (false && buf.length >= 3 && buf[0] === 0xef", 1]] },
  { id: "N2", protection: "R2-1: UTF-16LE (BOM) decode", edits: [[IDX, "  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe)", "  if (false && buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe)", 1]] },
  { id: "N3", protection: "R2-1: UTF-16BE (BOM) decode", edits: [[IDX, "  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff)", "  if (false && buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff)", 1]] },
  { id: "N4", protection: "R2-1: an undecodable input gets an encoding reason", edits: [[IDX, "    if (undecodable[key]) {", "    if (false && undecodable[key]) {", 1]] },
  { id: "N5", protection: "R2-1: an undecodable SUMMARY.md refuses --commit", edits: [[IDX, "  if (summaryRead?.undecodable) throw", "  if (summaryRead?.undecodable === \"never\") throw", 1]] },
  { id: "N6", protection: "R2-1: SUMMARY.md read through the decoder", edits: [[IDX, "planSummaryRemoval(summaryRead.text)", "planSummaryRemoval(readFileSync(summaryPath, \"utf-8\"))", 1]] },
  { id: "N7", protection: "R2-1: the latest log's date read through the decoder", edits: [[IDX, "decodeText(readFileSync(join(sessionsDir, best.file))).text", "readFileSync(join(sessionsDir, best.file), \"utf-8\")", 1]] },
  { id: "N8", protection: "R2-2: ahead of the log is not current", edits: [[IDX, "    if (d.n > latest.n) {", "    if (d.n > latest.n + 1000000) {", 1]] },
  { id: "N9", protection: "R2-3: rollback on failure", edits: [[IDX, "throw new Error(`${why}. ${rollBack(agents, snapshot.dir, archiveExisted, aside)}`);", "throw new Error(`${why}. ${false ? rollBack(agents, snapshot.dir, archiveExisted, aside) : \"\"}`);", 1]] },
  { id: "N10", protection: "R2-3: view directories created", edits: [[IDX, "for (const d of [\"SESSIONS\", \"TASKS\", \"SYSTEM\"]) mkdirSync(", "for (const d of [] as string[]) mkdirSync(", 1]] },
  { id: "N11", protection: "R2-3: a replaced snapshot is kept aside", edits: [[IDX, "  const aside = opts.forceSnapshot === true && existsSync(snapshotDir) ?", "  const aside = false && opts.forceSnapshot === true && existsSync(snapshotDir) ?", 1]] },
  { id: "N12", protection: "R2-3: the aside copy is removed on success", edits: [[IDX, "  if (aside) rmSync(aside, { recursive: true, force: true });\n", "", 1]] },
  { id: "N13", protection: "R2-3: a partial snapshot is removed", edits: [[IDX, "    rmSync(snapshotDir, { recursive: true, force: true });\n    if (!archiveExisted) rmSync(archive,", "    if (!archiveExisted) rmSync(archive,", 1]] },
  // N13 alone survives (0/44 here; the handoff reports 1): with no archive/ before the run, the next line removes
  // archive/ and the partial snapshot with it. N13b removes both lines, which is likely the developer's N13.
  { id: "N13b", protection: "R2-3: a partial snapshot is removed (both removals)", edits: [[IDX, "    rmSync(snapshotDir, { recursive: true, force: true });\n    if (!archiveExisted) rmSync(archive, { recursive: true, force: true });\n", "", 1]] },
  { id: "N14",protection: "R2-3: the rollback removes an archive/ it created", edits: [[IDX, "  if (!archiveExisted) rmSync(join(agents, \"archive\"), { recursive: true, force: true });\n", "", 1]] },
  { id: "N15", protection: "R2-4: a '-'-prefixed unknown token refuses", edits: [[CLI, "a.startsWith(\"-\") && !importFlags.includes(a)", "a.startsWith(\"--\") && !importFlags.includes(a)", 1]] },
  { id: "N16", protection: "R2-4: a second positional refuses", edits: [[CLI, "  if (positionals.length > 1) {", "  if (positionals.length > 99) {", 1]] },
  { id: "N17", protection: "R2-4: a missing directory refuses", edits: [[CLI, "  if (positionals.length === 1 && !(", "  if (false && positionals.length === 1 && !(", 1]] },
  // ---- mine, on the rollback's own steps
  { id: "R1", protection: "rollback: delete what the failed import wrote", edits: [[IDX, "for (const name of readdirSync(agents)) if (name !== \"archive\") rmSync(", "for (const name of [] as string[]) if (name !== \"archive\") rmSync(", 1]] },
  { id: "R2", protection: "rollback: copy the snapshot back", edits: [[IDX, "for (const name of readdirSync(snapshotDir)) cpSync(", "for (const name of [] as string[]) cpSync(", 1]] },
  { id: "R3", protection: "rollback: remove the snapshot after a restore", edits: [[IDX, "  rmSync(snapshotDir, { recursive: true, force: true });\n  if (!archiveExisted) rmSync(join(agents,", "  if (!archiveExisted) rmSync(join(agents,", 1]] },
  { id: "R4", protection: "rollback: put a --force-snapshot's earlier snapshot back", edits: [[IDX, "  if (aside) renameSync(aside, snapshotDir);\n  return \"Rolled back", "  return \"Rolled back", 1]] },
  // ---- an equivalent mutant, run to show why aba35de exists: with the explicit strip in place, TextDecoder's own
  // BOM handling cannot be observed. Expected to SURVIVE.
  { id: "E1", protection: "(equivalent) ignoreBOM back to TextDecoder's default", edits: [[IDX, "ignoreBOM: true", "ignoreBOM: false", 1]] },
];

function count(hay, needle) { let n = 0, i = 0; while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; } return n; }
function restore() { for (const f of [IDX, CLI]) writeFileSync(join(ob, f), orig[f]); for (const f of [IDX, CLI]) if (sha(f) !== origSha[f]) throw new Error(`restore failed for ${f}`); }
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;

const summary = [];
for (const m of MUTANTS) {
  if (only && !only.includes(m.id)) continue;
  restore();
  const text = { [IDX]: orig[IDX], [CLI]: orig[CLI] };
  let voidWhy = "";
  for (const [f, from, to, n] of m.edits) {
    const c = count(text[f], from);
    if (c !== n) { voidWhy = `edit in ${f} matched ${c} times, expected ${n}: ${JSON.stringify(from.slice(0, 70))}`; break; }
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
  const line = `${m.id} [${m.protection}] diff ${stat} | tsc exit ${tsc.status}${tsc.status ? " " + (tsc.stdout + tsc.stderr).trim().split("\n")[0] : ""} | vitest exit ${vt.status} | red ${failed.length}/${total}`;
  console.log(line);
  for (const f of failed) console.log(`    red: ${f}`);
  summary.push({ id: m.id, protection: m.protection, numstat: stat, tsc: tsc.status, vitest: vt.status, red: failed.length, total, failed });
}
restore();
const porcelain = execFileSync("git", ["-C", cand, "status", "--porcelain"], { encoding: "utf8" }).trim();
console.log(`restored: index.ts ${sha(IDX)} cli.ts ${sha(CLI)} (original ${origSha[IDX]} / ${origSha[CLI]}); git status --porcelain: ${porcelain === "" ? "clean" : porcelain}`);
writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2));
