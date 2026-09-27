#!/usr/bin/env node
// QA 153's own mutants on importer leftovers round 5 (e2f202b). Run from open-brain/ of a scratch worktree.
// Each edit must match exactly once; tsc --noEmit runs on every mutant; vitest runs every tests/pipelines/state-import*
// file with a JSON report (plus any extra test paths given after the id filter); the source is restored and its sha256
// checked after each mutant and at the end. No shell.
// Usage: node mutants-qa153.cjs <evidence-dir> [id|all] [extra test path ...]
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
const HEAD_TEST = "    if (!text.split(/\\r?\\n/).some((l) => ATX_HEADING.test(l))) {";

const MUTANTS = [
  // --- R5-1: the rule's reach
  ["A1-no-eol", "R5-1: `#` must be followed by a space; a bare `#` line is no longer a heading", IDX, [["const ATX_HEADING = /^#{1,6}( |$)/;", "const ATX_HEADING = /^#{1,6} /;"]]],
  ["A2-five-levels", "R5-1: levels 1 to 5 only", IDX, [["const ATX_HEADING = /^#{1,6}( |$)/;", "const ATX_HEADING = /^#{1,5}( |$)/;"]]],
  ["A3-no-upper-bound", "R5-1: seven or more `#` accepted", IDX, [["const ATX_HEADING = /^#{1,6}( |$)/;", "const ATX_HEADING = /^#+( |$)/;"]]],
  ["A4-tab-accepted", "R5-1: `#<TAB>` accepted (CommonMark, but not the ruling's words)", IDX, [["const ATX_HEADING = /^#{1,6}( |$)/;", "const ATX_HEADING = /^#{1,6}([ \\t]|$)/;"]]],
  ["A5-old-rule", "R5-1 reverted: only `# ` counts", IDX, [["const ATX_HEADING = /^#{1,6}( |$)/;", "const ATX_HEADING = /^# /;"]]],
  // --- R5-1: the wording by decode path
  ["A6-utf8-claims-encoding", "R5-1: the valid-UTF-8 wording blames the encoding again", IDX, [["  return `has no heading line (${rule}), so it cannot be judged: give it a title, or pass ${ACCEPT_STALE_FLAG}`;", "  return `has no heading line (${rule}): its encoding is not one the importer reads, UTF-7 among them, so its words cannot be read`;"]]],
  ["A7-bom-path-generic", "R5-1: the UTF-16 mark's sentence dropped; a BOM path worded as valid UTF-8", IDX, [["  if (encoding === \"utf16le-bom\" || encoding === \"utf16be-bom\") {", "  if (false) {"]]],
  ["A8-1252-generic", "R5-1: the Windows-1252 path loses its encoding sentence", IDX, [["  if (encoding === \"windows-1252\") return `has no heading line", "  if (false) return `has no heading line"]]],
  ["A9-draft-no-encodings", "R5-1: buildImportDraft passes no encodings (the draft words every path as valid UTF-8)", IDX, [["    staleness: detectStaleness(texts, last, undecodable, readAs, encodings),", "    staleness: detectStaleness(texts, last, undecodable, readAs, {}),"]]],
  ["A10-commit-no-encodings", "R5-1: runCommit passes no encodings (the refusal words a BOM path as valid UTF-8, unlike the draft)", IDX, [["onDisk.undecodable, onDisk.readAs, onDisk.encodings);", "onDisk.undecodable, onDisk.readAs, {});"]]],
  // --- QA 138's three survivors, re-expressed on the new code
  ["Q4r-heading-inbox-only", "QA 138 Q4: the heading rule on INBOX.md only", IDX, [[HEAD_TEST, "    if (key === \"inbox\" && !text.split(/\\r?\\n/).some((l) => ATX_HEADING.test(l))) {"]]],
  ["Q5r-bom-nul-offset", "QA 138 Q5: the BOM path's first NUL counted in characters", IDX, [["the first at byte ${2 + first * 2}", "the first at byte ${2 + first}"]]],
  ["Q6r-empty-branch", "QA 138 Q6: zero bytes no longer said to be empty", IDX, [["  if (text.length === 0) return \"has no heading line (it is empty), so its words cannot be read\";\n", ""]]],
  // --- R5-2
  ["B1-odd-judged", "R5-2: the odd byte dropped and the rest judged (undecodable null), as the LE path does", IDX, [["encoding: \"utf16be-bom\", undecodable: `has a UTF-16BE byte-order mark (FE FF), but an odd number of bytes (${buf.length}): UTF-16 is two bytes a character, so the mark does not match the bytes, and its words cannot be read` };", "encoding: \"utf16be-bom\", undecodable: null };"]]],
  ["B2-odd-count-wrong", "R5-2: the evidence counts the bytes after the mark, not the file's", IDX, [["but an odd number of bytes (${buf.length})", "but an odd number of bytes (${buf.length - 2})"]]],
  ["B3-odd-text-misaligned", "R5-2: the odd file's text decoded one byte off (subarray(3, len)), so 'as far as it reads' reads nothing", IDX, [["Buffer.from(buf.subarray(2, buf.length - 1)).swap16()", "Buffer.from(buf.subarray(3)).swap16()"]]],
  ["B4-odd-throws-again", "R5-2 reverted: the odd branch removed, swap16 throws", IDX, [["    if (buf.length % 2 === 1) {", "    if (false) {"]]],
  // --- R5-3
  ["C1-log-read-raw", "R5-3: the session log read with readFileSync, not readBytes", IDX, [["  const text = decodeText(readBytes(join(sessionsDir, best.file))).text;", "  const text = decodeText(readFileSync(join(sessionsDir, best.file))).text;"]]],
  ["C2-wrong-code", "R5-3: the wrap keyed on EPERM, not EBUSY", IDX, [["code === \"EBUSY\") throw", "code === \"EPERM\") throw"]]],
  ["C3-cause-dropped", "R5-3: the remedy kept, the cause dropped", IDX, [[": another program holds this file open; close it and re-run`", ": close it and re-run`"]]],
  // --- O-e
  ["E1-singular", "O-e reverted: 'the snapshot' whatever the count", IDX, [["${left.length === 1 ? \"the snapshot\" : \"every snapshot\"}", "the snapshot"]]],
  ["E2-it-not-todays", "O-e: 'which deletes it' whatever the count", IDX, [["${left.length === 1 ? \"it\" : \"today's\"}", "it"]]],
  ["E3-one-marker-todays", "O7: the one-marker text changed ('today's' for one marker)", IDX, [["${left.length === 1 ? \"it\" : \"today's\"}", "today's"]]],
];

function restore() {
  for (const f of [IDX, CLI]) { writeFileSync(f, orig[f]); if (sha(f) !== origSha[f]) throw new Error(`restore failed: ${f}`); }
}
const only = process.argv[3] && process.argv[3] !== "all" ? process.argv[3] : null;
const extra = process.argv.slice(4);
const lines = [];
const log = (s) => { console.log(s); lines.push(s); };
log(`mutants-qa153 at ${execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim()}, ${new Date().toISOString()}; tests: tests/pipelines/state-import* ${extra.join(" ")}`);
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
  const t0 = Date.now();
  const tsc = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "."], { encoding: "utf8" });
  const tscErr = (tsc.stdout + tsc.stderr).split(/\r?\n/).filter((l) => /error TS/.test(l));
  const json = join(ev, `${id}.vitest.json`);
  const vt = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/pipelines/state-import", ...extra, "--reporter=json", `--outputFile=${json}`], { encoding: "utf8" });
  restore();
  let red = [], total = 0, timeouts = 0;
  try {
    const r = JSON.parse(readFileSync(json, "utf8"));
    total = r.numTotalTests;
    for (const f of r.testResults) for (const a of f.assertionResults) if (a.status !== "passed") {
      const m = (a.failureMessages[0] ?? "").split("\n")[0];
      if (/timed out/i.test(m)) timeouts++;
      red.push(`${f.name.replace(/.*tests[\\/]/, "")} > ${a.fullName} :: ${m.slice(0, 160)}`);
    }
  } catch (e) { red.push(`(no JSON: vitest exit ${vt.status})`); }
  const assertionRed = red.length - timeouts;
  const verdict = tscErr.length ? "KILLED by tsc" : assertionRed ? "KILLED" : red.length ? "SURVIVED (only timeouts red)" : "SURVIVED";
  log(`${id}: ${verdict} (${what}); tsc ${tscErr.length ? tscErr.slice(0, 2).join(" / ") : "clean"}; vitest exit ${vt.status}, red ${red.length} of ${total}${timeouts ? ` (${timeouts} timeouts)` : ""}; ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const r of red) log(`    red: ${r}`);
}
restore();
log(`restored: ${IDX} ${sha(IDX) === origSha[IDX] ? "clean" : "DIRTY"}, ${CLI} ${sha(CLI) === origSha[CLI] ? "clean" : "DIRTY"}; ${new Date().toISOString()}`);
writeFileSync(join(ev, `mutants-qa153${only ? `-${only}` : ""}.out`), lines.join("\n") + "\n");
