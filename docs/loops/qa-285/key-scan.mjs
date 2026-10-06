#!/usr/bin/env node
// QA 285: the key scan, as QA 248's (docs/loops/qa-248/key-scan.mjs), over this run's outputs.
// Differences from QA 248's, and only these: the key is read from HKCU\Environment into this process (as the live
// runner did; the job never exported it to the shell), and the categories are this run's files.
// The value is never printed: the output is counts and ABSOLUTE file paths only.
// Order: (1) known positive on a temp file holding the key, which must report exactly 1 hit, then the file is
// deleted; (2) each category is scanned; PASS is 0 matches with files scanned > 0 in every one.
// K1: the transcript is named by session id; exactly one .jsonl under ~/.claude/projects may hold the marker,
// and it must be <slug>/<session>.jsonl.
// Usage (any cwd; the repo is found from this file's location): node docs/loops/qa-285/key-scan.mjs --session <uuid> --marker <text>
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const session = arg("session");
const marker = arg("marker");
if (!session || !/^[0-9a-f-]{36}$/.test(session) || !marker) {
  console.log("usage: key-scan.mjs --session <uuid> --marker <text>");
  process.exit(64);
}

const reg = execFileSync("reg", ["query", "HKCU\\Environment", "/v", "TYPESAFE_API_KEY"], { encoding: "utf8" });
const m = reg.split(/\r?\n/).map((l) => l.match(/TYPESAFE_API_KEY\s+REG_(?:EXPAND_)?SZ\s+(.*)$/)).find(Boolean);
const key = m ? m[1].trim() : "";
if (key.length === 0) {
  console.log("key-scan: TYPESAFE_API_KEY is absent from HKCU\\Environment; nothing to search for. FAIL (not a pass)");
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
const probe = join(tmpDir, `qa285-known-positive-${randomBytes(6).toString("hex")}.txt`);
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

// 3. Categories. Every file this job commits (the git index of the report branch, minus key-scan.out itself,
// which is written after), plus the uncommitted logs.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const committed = execFileSync("git", ["-C", REPO, "diff", "--cached", "--name-only", "HEAD"], { encoding: "utf8" })
  .split(/\r?\n/).filter(Boolean).filter((p) => !p.endsWith("key-scan.out")).map((p) => abs(join(REPO, p)));
const categories = {
  "every file staged for the report commit (records, ledger, report, evidence)": committed,
  "the run's logs and scratch outputs (live stdout/stderr, dry-run records, HTTP bodies, build log)": walk("C:/qa-tmp/qa285", () => true).map(abs),
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
