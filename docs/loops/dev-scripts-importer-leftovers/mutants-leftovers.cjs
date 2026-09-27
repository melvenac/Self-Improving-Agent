// Mutants for the importer leftovers (R4-4, R4-5, O7, O14): one per protection.
// Run from open-brain/:  node ../docs/loops/dev-scripts-importer-leftovers/mutants-leftovers.cjs <evidence-dir>
// No shell: tsc and vitest are run as node scripts with an args array. Each edit must match
// exactly once or the mutant is refused; tsc runs on every mutant; the source is restored and
// its sha256 checked after each; each mutant's `git diff` is saved beside its result.
const { execFileSync, spawnSync } = require("node:child_process");
const { readFileSync, writeFileSync, mkdirSync, existsSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join, resolve } = require("node:path");

const out = resolve(process.argv[2] || "mutants-out");
mkdirSync(out, { recursive: true });
if (!existsSync("src/pipelines/state-import/index.ts")) { console.error("run from open-brain/"); process.exit(2); }

const IDX = "src/pipelines/state-import/index.ts";
const CLI = "src/cli.ts";
const TESTS = ["tests/pipelines/state-import"];

// [id, file, find, replace, what it removes, "vitest" | "tsc" (which instrument must go red)]
const MUTANTS = [
  ["M1-utf32-first", IDX, "if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xfe && buf[2] === 0 && buf[3] === 0) {", "if (buf.length < 0) {", "R4-4: UTF-32LE's mark is no longer tested before UTF-16LE's", "vitest"],
  ["M2-le-bom-nul", IDX, 'return withBomCheck(buf.subarray(2).toString("utf16le"), "utf16le-bom");', 'return { text: buf.subarray(2).toString("utf16le"), encoding: "utf16le-bom", undecodable: null };', "R4-4: no NUL check on the UTF-16LE BOM path", "vitest"],
  ["M3-be-bom-nul", IDX, 'return withBomCheck(Buffer.from(buf.subarray(2)).swap16().toString("utf16le"), "utf16be-bom");', 'return { text: Buffer.from(buf.subarray(2)).swap16().toString("utf16le"), encoding: "utf16be-bom", undecodable: null };', "R4-4: no NUL check on the UTF-16BE BOM path", "vitest"],
  ["M4-no-title", IDX, 'if (!text.split(/\\r?\\n/).some((l) => l.startsWith("# "))) {', 'if (!text.split(/\\r?\\n/).some((l) => l.startsWith("# ")) && text === "\\u0001never") {', "R4-4: a judged input with no readable `# ` title is no longer unreadable", "vitest"],
  ["M5-not-judged-line", IDX, 'NOT_JUDGED_REASON[key]! + (undecodable[key] ? `. It ${undecodable[key]}` : "")', "NOT_JUDGED_REASON[key]!", "R4-5: the not-judged line no longer names the unreadable bytes", "vitest"],
  ["M6-report-block", IDX, 'if (r.decisions_unreadable) { L.push("", "**Not read in full:**");', 'if (r.decisions_unreadable && r.migration_date === "never") { L.push("", "**Not read in full:**");', "R4-5: the report's Decisions section no longer names them", "vitest"],
  ["M7-draft-source", IDX, "if (texts.decisions && undecodable.decisions) report.decisions_unreadable =", "if (texts.decisions && undecodable.decisions && today === \"never\") report.decisions_unreadable =", "R4-5: the draft never computes decisions_unreadable", "vitest"],
  ["M8-commit-output", CLI, "    if (r.decisions_unreadable) for (const l of describeDecisionsUnreadable(r.decisions_unreadable)) console.log(l);\n", "", "R4-5: --commit's output no longer names them", "vitest"],
  ["M9-draft-output", CLI, "      if (rep.decisions_unreadable) for (const l of describeDecisionsUnreadable(rep.decisions_unreadable)) console.log(`  ${l}`);\n", "", "R4-5: --draft's output no longer names them", "vitest"],
  ["M10-no-nul-strip", IDX, 'importDecisions(text.replace(/\\u0000/g, ""), ', "importDecisions(text, ", "R4-5: the not-imported ADRs are looked for without removing the NULs", "vitest"],
  ["M11-no-filter", IDX, "not_imported: seen.filter((id) => !imported.includes(id))", "not_imported: seen", "R4-5: not_imported also lists what was imported", "vitest"],
  ["M12-o7-reversed", IDX, "n.endsWith(INCOMPLETE_SUFFIX)).sort();\n}", "n.endsWith(INCOMPLETE_SUFFIX)).sort().reverse();\n}", "O7: the newest snapshot is named as the oldest", "vitest"],
  // Survived at 3875c2d on NTFS and on tcm (36229998699), when the sort sat inline in
  // refuseHalfRestored: both list the directory in name order. markersOldestFirst's direct test holds it now.
  ["M13-o7-unsorted", IDX, "n.endsWith(INCOMPLETE_SUFFIX)).sort();\n}", "n.endsWith(INCOMPLETE_SUFFIX));\n}", "O7: directory order, not date order", "vitest"],
  ["M14-o7-one-marker-text", IDX, "const from = snapshots.length === 1", "const from = snapshots.length >= 1", "O7: two markers get the one-marker sentence", "vitest"],
  ["M15-o14-optional", IDX, 'verdict: "could_not_tell"; could_not_tell: CouldNotTell });', 'verdict: "could_not_tell"; could_not_tell?: CouldNotTell });', "O14: the reason is optional again", "tsc"],
  ["M16-o14-producer", IDX, 'so its words cannot be read`, could_not_tell: "unreadable" });', "so its words cannot be read` });", "O14: a producer leaves the reason out", "tsc"],
];

const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const tsc = () => spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "."], { encoding: "utf8" });
function vitest(id) {
  const json = join(out, `${id}.vitest.json`);
  const r = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...TESTS, "--reporter=json", `--outputFile=${json}`], { encoding: "utf8" });
  let failed = [], total = 0;
  if (existsSync(json)) {
    const j = JSON.parse(readFileSync(json, "utf8"));
    total = j.numTotalTests;
    for (const f of j.testResults) for (const a of f.assertionResults) if (a.status === "failed") failed.push(`${f.name.replace(/\\/g, "/").split("/tests/")[1]} > ${a.fullName}`);
  }
  return { status: r.status, failed, total };
}

const originals = Object.fromEntries([IDX, CLI].map((f) => [f, readFileSync(f, "utf8")]));
const lines = [];
const log = (s) => { console.log(s); lines.push(s); };
log(`HEAD ${execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim()}; sources ${IDX} ${sha(originals[IDX])}, ${CLI} ${sha(originals[CLI])}; ${new Date().toISOString()}`);
if (execFileSync("git", ["status", "--porcelain", "--", "src"], { encoding: "utf8" }).trim()) { console.error("src/ is dirty; refusing"); process.exit(2); }

for (const [id, file, find, replace, what, instrument] of MUTANTS) {
  const src = originals[file];
  const n = src.split(find).length - 1;
  if (n !== 1) { log(`${id}: REFUSED — the edit matches ${n} times in ${file}`); continue; }
  writeFileSync(file, src.replace(find, replace));
  try {
    if (readFileSync(file, "utf8") === src) { log(`${id}: REFUSED — the edit did not land`); continue; }
    writeFileSync(join(out, `${id}.diff`), execFileSync("git", ["diff", "--", file], { encoding: "utf8" }));
    const t = tsc();
    const tscErrors = (t.stdout.match(/error TS\d+/g) || []).length;
    if (instrument === "tsc") {
      log(`${id}: ${t.status !== 0 ? "KILLED" : "SURVIVED"} by tsc (exit ${t.status}, ${tscErrors} error(s): ${(t.stdout.split("\n").find((l) => /error TS/.test(l)) || "").trim()}) — ${what}`);
      continue;
    }
    if (t.status !== 0) { log(`${id}: INVALID — tsc exit ${t.status}: ${(t.stdout.split("\n").find((l) => /error TS/.test(l)) || "").trim()}`); continue; }
    const v = vitest(id);
    log(`${id}: ${v.failed.length > 0 ? "KILLED" : "SURVIVED"} — tsc 0; vitest exit ${v.status}, ${v.failed.length} of ${v.total} red — ${what}`);
    for (const f of v.failed) log(`    ${f}`);
  } finally {
    writeFileSync(file, src);
    if (sha(readFileSync(file, "utf8")) !== sha(src)) { log(`${id}: RESTORE FAILED`); process.exit(3); }
  }
}
const dirty = execFileSync("git", ["status", "--porcelain", "--", "src"], { encoding: "utf8" }).trim();
log(`restored: ${dirty ? `NO — ${dirty}` : "src/ clean"}; ${new Date().toISOString()}`);
writeFileSync(join(out, "mutants-leftovers.out"), lines.join("\n") + "\n");
