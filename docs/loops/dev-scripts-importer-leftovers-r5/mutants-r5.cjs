// Mutants for importer leftovers round 5 (R5-1, R5-2, R5-3, O-e): one per protection.
// Run from open-brain/:  node ../docs/loops/dev-scripts-importer-leftovers-r5/mutants-r5.cjs <evidence-dir>
// The leftovers' driver (dev-scripts-importer-leftovers/mutants-leftovers.cjs) with a new list; the machinery is unchanged.
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

// Round 5 (record 147): one per protection the rulings on QA 138 add.
// [id, file, find, replace, what it removes, "vitest" | "tsc" (which instrument must go red)]
const MUTANTS = [
  ["R5M1-hash-space-only", IDX, "some((l) => ATX_HEADING.test(l))", 'some((l) => l.startsWith("# "))', "R5-1: the old `# `-only rule, so a `##`-only file is unreadable again", "vitest"],
  ["R5M2-be-odd-throws", IDX, "if (buf.length % 2 === 1) {", "if (buf.length % 2 === 1 && buf.length < 0) {", "R5-2: an odd-length UTF-16BE input reaches swap16 and throws", "vitest"],
  ["R5M3-utf8-encoding-claim", IDX, "return `has no heading line (${rule}), so it cannot be judged: give it a title, or pass ${ACCEPT_STALE_FLAG}`;", "return `has no heading line (${rule}): its encoding is not one the importer reads, UTF-7 among them`;", "R5-1: the old encoding wording on a valid-UTF-8 file", "vitest"],
  ["R5M4-utf16-wording", IDX, 'if (encoding === "utf16le-bom" || encoding === "utf16be-bom") {', 'if ((encoding === "utf16le-bom" || encoding === "utf16be-bom") && text === "\\u0001") {', "R5-1: a UTF-16 mark's decode no longer named in the evidence", "vitest"],
  ["R5M5-1252-wording", IDX, 'if (encoding === "windows-1252") return', 'if (encoding === "windows-1252" && text === "\\u0001") return', "R5-1: a Windows-1252 guess loses its encoding sentence", "vitest"],
  ["R5M6-seven-hashes", IDX, "const ATX_HEADING = /^#{1,6}( |$)/;", "const ATX_HEADING = /^#{1,7}( |$)/;", "R5-1: `#######` counted as a heading", "vitest"],
  ["R5M7-no-end-of-line", IDX, "const ATX_HEADING = /^#{1,6}( |$)/;", "const ATX_HEADING = /^#{1,6} /;", "R5-1: a bare `#` line not counted as a heading", "vitest"],
  ["R5M8-ebusy-raw", IDX, '(err as NodeJS.ErrnoException).code === "EBUSY"', '(err as NodeJS.ErrnoException).code === "EBUSY-never"', "R5-3: EBUSY is Node's raw message again", "vitest"],
  // The leftovers' M4 and M16, ported: their find text is the line R5-1 replaced.
  ["R5M10-no-heading-rule-off", IDX, "if (!text.split(/\\r?\\n/).some((l) => ATX_HEADING.test(l))) {", 'if (!text.split(/\\r?\\n/).some((l) => ATX_HEADING.test(l)) && text === "\\u0001never") {', "R4-4 (was M4): a judged input with no heading line is no longer unreadable", "vitest"],
  ["R5M11-o14-producer", IDX, 'evidence: noHeading(text, encodings[key]), could_not_tell: "unreadable" });', "evidence: noHeading(text, encodings[key]) });", "O14 (was M16): a producer leaves the reason out", "tsc"],
  ["R5M9-oe-singular", IDX, 'left.length === 1 ? "the snapshot" : "every snapshot"', '"the snapshot"', "O-e: two markers speak of one snapshot again", "vitest"],
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
writeFileSync(join(out, "mutants-r5.out"), lines.join("\n") + "\n");
