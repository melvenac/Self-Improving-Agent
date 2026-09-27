#!/usr/bin/env node
// QA 138's own mutants on the importer leftovers (d500730). Run from open-brain/ of a scratch worktree.
// Each edit must match exactly once; tsc --noEmit runs on every mutant; vitest runs the 10 importer files with a JSON
// report; the source is restored and its sha256 checked after each mutant and at the end. No shell.
// Usage: node mutants-qa138.cjs <evidence-dir>
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { spawnSync, execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { join } = require("node:path");
const ev = process.argv[2];
mkdirSync(ev, { recursive: true });
const IDX = "src/pipelines/state-import/index.ts";
const CLI = "src/cli.ts";
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const orig = { [IDX]: readFileSync(IDX, "utf8"), [CLI]: readFileSync(CLI, "utf8") };
const origSha = { [IDX]: sha(IDX), [CLI]: sha(CLI) };

const MUTANTS = [
  // --- the three the dispatch names
  ["Q1-utf32-after-utf16", "R4-4: the UTF-32LE test moved back AFTER UTF-16LE's", IDX, [
    ["  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xfe && buf[2] === 0 && buf[3] === 0) {\n    return { text: buf.toString(\"utf-8\"), encoding: \"utf32le-bom\", undecodable: \"starts with a UTF-32LE byte-order mark (FF FE 00 00): the importer reads UTF-8, UTF-16 and Windows-1252, not UTF-32, so its words cannot be read\" };\n  }\n  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return withBomCheck(buf.subarray(2).toString(\"utf16le\"), \"utf16le-bom\");",
     "  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return withBomCheck(buf.subarray(2).toString(\"utf16le\"), \"utf16le-bom\");\n  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xfe && buf[2] === 0 && buf[3] === 0) {\n    return { text: buf.toString(\"utf-8\"), encoding: \"utf32le-bom\", undecodable: \"starts with a UTF-32LE byte-order mark (FF FE 00 00): the importer reads UTF-8, UTF-16 and Windows-1252, not UTF-32, so its words cannot be read\" };\n  }"],
  ]],
  ["Q1b-utf32-after-utf16-no-bom-nul", "R4-4: UTF-32LE after UTF-16LE AND the LE BOM path's NUL check gone (QA 122's D11 exactly)", IDX, [
    ["  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xfe && buf[2] === 0 && buf[3] === 0) {\n    return { text: buf.toString(\"utf-8\"), encoding: \"utf32le-bom\", undecodable: \"starts with a UTF-32LE byte-order mark (FF FE 00 00): the importer reads UTF-8, UTF-16 and Windows-1252, not UTF-32, so its words cannot be read\" };\n  }\n  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return withBomCheck(buf.subarray(2).toString(\"utf16le\"), \"utf16le-bom\");",
     "  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return { text: buf.subarray(2).toString(\"utf16le\"), encoding: \"utf16le-bom\", undecodable: null };\n  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xfe && buf[2] === 0 && buf[3] === 0) {\n    return { text: buf.toString(\"utf-8\"), encoding: \"utf32le-bom\", undecodable: \"starts with a UTF-32LE byte-order mark (FF FE 00 00): the importer reads UTF-8, UTF-16 and Windows-1252, not UTF-32, so its words cannot be read\" };\n  }"],
  ]],
  ["Q2-no-title-removed", "R4-4: the no-readable-title rule removed", IDX, [
    ["    if (!text.split(/\\r?\\n/).some((l) => l.startsWith(\"# \"))) {", "    if (false) {"],
  ]],
  ["Q2b-no-title-removed-typed", "R4-4: the no-readable-title rule removed, narrowing kept (tsc clean)", IDX, [
    ["    if (!text.split(/\\r?\\n/).some((l) => l.startsWith(\"# \"))) {", "    if (!text.split(/\\r?\\n/).some((l) => l.startsWith(\"# \")) && false) {"],
  ]],
  ["Q3-commit-naming-dropped", "R4-5: the naming dropped from --commit's output (cli.ts)", CLI, [
    ["    if (r.decisions_unreadable) for (const l of describeDecisionsUnreadable(r.decisions_unreadable)) console.log(l);\n", ""],
  ]],
  // --- mine, where the tests look thin
  ["Q4-no-title-inbox-only", "R4-4: the no-title rule applied to INBOX.md only (not task.md, next-session.md)", IDX, [
    ["    if (!text.split(/\\r?\\n/).some((l) => l.startsWith(\"# \"))) {", "    if (key === \"inbox\" && !text.split(/\\r?\\n/).some((l) => l.startsWith(\"# \"))) {"],
  ]],
  ["Q5-bom-nul-offset", "R4-4: the BOM path's first-NUL byte counted in characters, not bytes", IDX, [
    ["the first at byte ${2 + first * 2}", "the first at byte ${2 + first}"],
  ]],
  ["Q6-empty-branch", "R4-4: the no-title evidence no longer says 'it is empty' for zero bytes", IDX, [
    ["${text.length === 0 ? \"it is empty\" : \"its encoding", "${false ? \"it is empty\" : \"its encoding"],
  ]],
  ["Q7-commit-imported-empty", "R4-5: --commit's naming computed against an empty imported list", IDX, [
    ["decisionsUnreadable(decisionsText, onDisk.undecodable.decisions, parsed.data.decisions.map((d) => d.id))", "decisionsUnreadable(decisionsText, onDisk.undecodable.decisions, [])"],
  ]],
  ["Q8-commit-result-null", "R4-5: runCommit returns no decisions_unreadable at all", IDX, [
    ["  const decisions_unreadable = decisionsText !== null && onDisk.undecodable.decisions ? ", "  const decisions_unreadable = false && decisionsText !== null && onDisk.undecodable.decisions ? "],
  ]],
  ["Q9-draft-imported-listed-as-not", "R4-5: the not-imported list no longer excludes the imported ADRs, and imported prints none", IDX, [
    ["    `ADRs imported: ${u.imported.length ? u.imported.join(\", \") : \"none\"}`,", "    `ADRs imported: none`,"],
  ]],
  ["Q10-o14-third-arm", "O14: a third InputStaleness arm with no reason (the union widened)", IDX, [
    ["  | (JudgedInput & { verdict: \"could_not_tell\"; could_not_tell: CouldNotTell });", "  | (JudgedInput & { verdict: \"could_not_tell\"; could_not_tell: CouldNotTell })\n  | (JudgedInput & { verdict: StalenessVerdict });"],
  ]],
  ["Q11-o7-newest-named", "O7: the refusal names the NEWEST as the one holding the originals", IDX, [
    ["  const left = markersOldestFirst(readdirSync(archive));", "  const left = markersOldestFirst(readdirSync(archive)).reverse();"],
  ]],
];

function restore() {
  for (const f of [IDX, CLI]) { writeFileSync(f, orig[f]); if (sha(f) !== origSha[f]) throw new Error(`restore failed: ${f}`); }
}
const only = process.argv[3];
const lines = [];
const log = (s) => { console.log(s); lines.push(s); };
log(`mutants-qa138 at ${execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim()}, ${new Date().toISOString()}`);
for (const [id, what, file, edits] of MUTANTS) {
  if (only && id !== only) continue;
  let src = orig[file];
  for (const [from, to] of edits) {
    const n = src.split(from).length - 1;
    if (n !== 1) { log(`${id}: VOID, the edit matched ${n} times`); src = null; break; }
    src = src.replace(from, to);
  }
  if (src === null) continue;
  writeFileSync(file, src);
  execFileSync("git", ["diff", "--", file]); // proves git sees it
  writeFileSync(join(ev, `${id}.diff`), execFileSync("git", ["diff", "--", file], { encoding: "utf8" }));
  const t0 = Date.now();
  const tsc = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "."], { encoding: "utf8" });
  const tscErr = (tsc.stdout + tsc.stderr).split(/\r?\n/).filter((l) => /error TS/.test(l));
  const json = join(ev, `${id}.vitest.json`);
  const vt = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/pipelines/state-import", "--reporter=json", `--outputFile=${json}`], { encoding: "utf8" });
  restore();
  let red = [], total = 0;
  try {
    const r = JSON.parse(readFileSync(json, "utf8"));
    total = r.numTotalTests;
    for (const f of r.testResults) for (const a of f.assertionResults) if (a.status !== "passed") red.push(`${f.name.replace(/.*tests[\\/]/, "")} > ${a.fullName} :: ${(a.failureMessages[0] ?? "").split("\n")[0].slice(0, 160)}`);
  } catch (e) { red.push(`(no JSON: vitest exit ${vt.status})`); }
  const verdict = tscErr.length ? "KILLED by tsc" : red.length ? "KILLED" : "SURVIVED";
  log(`${id}: ${verdict} (${what}); tsc ${tscErr.length ? tscErr.slice(0, 2).join(" / ") : "clean"}; vitest exit ${vt.status}, red ${red.length} of ${total}; ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const r of red) log(`    red: ${r}`);
}
restore();
log(`restored: ${IDX} ${sha(IDX) === origSha[IDX] ? "clean" : "DIRTY"}, ${CLI} ${sha(CLI) === origSha[CLI] ? "clean" : "DIRTY"}; ${new Date().toISOString()}`);
writeFileSync(join(ev, "mutants-qa138.out"), lines.join("\n") + "\n");
