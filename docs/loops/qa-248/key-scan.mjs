#!/usr/bin/env node
// QA 248, S4-3b.2 (re-run of QA 245's scan, amended by D-092 K1): search the step-4 outputs for the live key.
// The value searched for is read from this process's environment (TYPESAFE_API_KEY), never from an
// argument or a file, and is never printed: the output is counts and ABSOLUTE file paths only.
// Order: (1) known positive on a temp file holding the key, which must report exactly 1 hit, then the
// file is deleted; (2) each category is scanned; PASS is 0 matches with files scanned > 0 in every one.
// K1: the transcript is named by session id, not guessed. `--session <uuid>` names this seat's session;
// `--marker <text>` is a string only this session's transcript holds. The script requires that exactly one
// .jsonl under ~/.claude/projects holds the marker and that it is <slug>/<session>.jsonl, then prints its
// absolute path. Any other result makes the transcript category empty, which fails the scan.
// Usage (from the worktree root): node docs/loops/qa-248/key-scan.mjs --session <uuid> --marker <text>
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const session = arg("session");
const marker = arg("marker");
if (!session || !/^[0-9a-f-]{36}$/.test(session) || !marker) {
  console.log("usage: key-scan.mjs --session <uuid> --marker <text>");
  process.exit(64);
}

const key = process.env.TYPESAFE_API_KEY ?? "";
if (key.length === 0) {
  console.log("key-scan: TYPESAFE_API_KEY is absent from the environment; nothing to search for. FAIL (not a pass)");
  process.exit(2);
}

const count = (path) => {
  const text = readFileSync(path, "utf8");
  let n = 0;
  for (let i = text.indexOf(key); i !== -1; i = text.indexOf(key, i + 1)) n += 1;
  return n;
};
const walk = (dir, keep) => {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, keep));
    else if (keep(p)) out.push(p);
  }
  return out;
};
const abs = (p) => resolve(p).replace(/\\/g, "/");

// 1. Known positive.
const tmpDir = "C:/qa-tmp";
mkdirSync(tmpDir, { recursive: true });
const probe = join(tmpDir, `qa248-known-positive-${randomBytes(6).toString("hex")}.txt`);
writeFileSync(probe, `before ${key} after\n`);
const kp = count(probe);
rmSync(probe);
console.log(`known positive: ${kp} hit(s) on a temp file (expected 1); temp file deleted: ${!existsSync(probe)}`);
if (kp !== 1 || existsSync(probe)) {
  console.log("key-scan: FAIL: the known positive did not behave");
  process.exit(1);
}

// 2. This session's transcript, by session id and marker (K1).
const projects = "C:/Users/Aaron/.claude/projects";
const slug = "C--Users-Aaron-Worktrees-sia-qa";
const expected = abs(join(projects, slug, `${session}.jsonl`));
const withMarker = walk(projects, (p) => p.endsWith(".jsonl")).filter((p) => readFileSync(p, "utf8").includes(marker)).map(abs);
console.log(`transcript: session ${session}; expected ${expected}; exists ${existsSync(expected)}`);
console.log(`transcript: .jsonl files under ${projects} holding the marker: ${withMarker.length} (${withMarker.join(", ")})`);
const transcriptOk = existsSync(expected) && withMarker.length === 1 && withMarker[0] === expected;
console.log(`transcript: the one marked file is the session's own: ${transcriptOk}`);

// 3. Categories.
const categories = {
  "gate records, E_t copies and the attempts ledger (live), and the dry-run records": [
    ...walk("docs/loops/loop-15-slice-4-records", (p) => /\.(G_done|G_qa)\..*\.json$|attempts\.jsonl$|\.E_t\.json$/.test(p)),
    ...walk("docs/loops", (p) => /loop-15-slice-4-brief\.G_plan\..*\.json$/.test(p)),
    ...walk("C:/qa-scratch/qa248-dry", () => true),
  ].map(abs),
  "the run's captured stdout and stderr (every harness command, npm ci, build, tsc)": walk("C:/qa-scratch/qa248-logs", () => true).map(abs),
  "the close-out and this report": [
    "docs/loops/loop-15-slice-4-closeout.md",
    "docs/loops/loop-15-slice-4-step4-rerun-qa-report.md",
    "docs/loops/loop-15-slice-4-step4-rerun-qa-report.E_t.json",
  ].filter((p) => existsSync(p)).map(abs),
  "this session's transcript (.jsonl)": transcriptOk ? [expected] : [],
};

let total = 0;
let empty = false;
for (const [name, files] of Object.entries(categories)) {
  let hits = 0;
  for (const f of files) hits += count(f);
  total += hits;
  if (files.length === 0) empty = true;
  console.log(`${name}: files scanned ${files.length}, matches ${hits}`);
  for (const f of files) console.log(`  ${f}`);
}
const pass = total === 0 && !empty;
console.log(`key-scan: total matches ${total}; every category scanned at least one file: ${!empty}; ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
