#!/usr/bin/env node
// QA 172's own mutants on importer leftovers round 6 (c2ee52d). Run from open-brain/ of a scratch worktree.
// Usage: node mutants-qa172.cjs <evidence-dir> [id|all]
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
  ["M1-no-name", "QA 153 D1: describeLastSession returns null, so the log is not named", IDX, [
    ["export function describeLastSession(last: ImportReport[\"last_session\"]): string | null {\n  if (!last.unreadable) return null;\n  return `${last.file} ${last.unreadable}. Date used: ${last.date}, ${last.date_why}.`;\n}",
     "export function describeLastSession(last: ImportReport[\"last_session\"]): string | null {\n  return null;\n}"],
  ]],
  ["M2-date-silent", "QA 153 D1: the unread why-string shortened to 'the migration date'", IDX, [
    ["return row(best.n, file, today, uuid, \"the migration date, because the log's date line could not be read\", decoded.undecodable);",
     "return row(best.n, file, today, uuid, \"the migration date\", decoded.undecodable);"],
  ]],
  ["M3-none-found", "DECISIONS line: the odd-length branch returned 'none found'", IDX, [
    ["  if (/odd number of bytes/.test(u.evidence)) return \"could not be read\";",
     "  if (/odd number of bytes/.test(u.evidence)) return \"none found\";"],
  ]],
  ["M4-cli-draft-drop", "QA 153 D1: --draft stdout omits describeLastSession", CLI, [
    ["      const lastDraft = describeLastSession(rep.last_session);\n      if (lastDraft) console.log(lastDraft);",
     "      // last session line dropped"],
  ]],
  ["M5-report-drop", "QA 153 D1: the report's Last session section omits describeLastSession", IDX, [
    ["  const lastLine = describeLastSession(r.last_session);\n  if (lastLine) L.push(lastLine);",
     "  // last session unreadable line dropped"],
  ]],
];

function restore() {
  for (const f of [IDX, CLI]) {
    writeFileSync(f, orig[f]);
    if (sha(f) !== origSha[f]) throw new Error(`restore failed: ${f}`);
  }
}
const only = process.argv[3] && process.argv[3] !== "all" ? process.argv[3] : null;
const lines = [];
const log = (s) => { console.log(s); lines.push(s); };
log(`mutants-qa172 at ${execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim()}, ${new Date().toISOString()}; tests: tests/pipelines/state-import-r6.test.ts`);
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
  writeFileSync(join(ev, `${id}.diff`), execFileSync("git", ["diff", "--", file], { encoding: "utf8" }));
  const tsc = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "."], { encoding: "utf8" });
  const tscErr = (tsc.stdout + tsc.stderr).split(/\r?\n/).filter((l) => /error TS/.test(l));
  const json = join(ev, `${id}.vitest.json`);
  const vt = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/pipelines/state-import-r6.test.ts", "--reporter=json", `--outputFile=${json}`], { encoding: "utf8" });
  restore();
  let red = [], total = 0;
  try {
    const r = JSON.parse(readFileSync(json, "utf8"));
    total = r.numTotalTests;
    for (const s of r.testResults ?? []) for (const a of s.assertionResults ?? []) if (a.status === "failed") red.push(`${s.name} > ${a.title}`);
  } catch { red = ["(no vitest json)"]; }
  const status = red.length ? "KILLED" : "SURVIVED";
  log(`${id}: ${status} (${what}); tsc ${tscErr.length ? "ERR " + tscErr.length : "clean"}; vitest exit ${vt.status}, red ${red.length} of ${total}`);
  for (const r of red) log(`    red: ${r}`);
}
restore();
log(`restored: ${IDX} clean, ${CLI} clean; ${new Date().toISOString()}`);
