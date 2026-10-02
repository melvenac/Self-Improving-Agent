#!/usr/bin/env node
// QA 245, S4-3b.2: search the step-4 outputs for the live key.
// The value searched for is read from this process's environment (TYPESAFE_API_KEY), never from an
// argument or a file, and is never printed: the output is counts and file paths only.
// Order: (1) known positive on a temp file holding the key, which must report exactly 1 hit, then the
// file is deleted; (2) each category is scanned; PASS is 0 matches with files scanned > 0 in every one.
// Usage (from the worktree root): node docs/loops/qa-245/key-scan.mjs
// Paths are QA 245's own run: the scratch log dir and the seat's transcript dir on the laptop.
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

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

// 1. Known positive.
const tmpDir = "C:/qa-tmp";
mkdirSync(tmpDir, { recursive: true });
const probe = join(tmpDir, `qa245-known-positive-${randomBytes(6).toString("hex")}.txt`);
writeFileSync(probe, `before ${key} after\n`);
const kp = count(probe);
rmSync(probe);
console.log(`known positive: ${kp} hit(s) on a temp file (expected 1); temp file deleted: ${!existsSync(probe)}`);
if (kp !== 1 || existsSync(probe)) {
  console.log("key-scan: FAIL: the known positive did not behave");
  process.exit(1);
}

// 2. Categories.
const transcriptDir = "C:/Users/Aaron/.claude/projects/C--Users-Aaron-Worktrees-sia-qa";
const transcripts = walk(transcriptDir, (p) => p.endsWith(".jsonl") && !p.includes(`${join(transcriptDir, "")}subagents`))
  .map((p) => ({ p, m: statSync(p).mtimeMs }))
  .sort((a, b) => b.m - a.m);
// This session's transcript: the newest .jsonl in the seat's slug dir that names this run's worktree.
const own = transcripts.find(({ p }) => readFileSync(p, "utf8").includes("qa245-wt"));

const categories = {
  "gate records and the attempts ledger (live and dry-run)": [
    ...walk("docs/loops/loop-15-slice-4-records", (p) => /\.(G_done|G_qa)\..*\.json$|attempts\.jsonl$|\.E_t\.json$/.test(p)),
    ...walk("docs/loops", (p) => /loop-15-slice-4-brief\.G_plan\..*\.json$/.test(p)),
    ...walk("C:/qa-scratch/qa245-dry", () => true),
  ],
  "the live run's captured stdout and stderr": walk("C:/qa-scratch/qa245-logs", (p) => /\.(out|err|cmd)$/.test(p)),
  "the close-out and this report": ["docs/loops/loop-15-slice-4-closeout.md", "docs/loops/loop-15-slice-4-step4-qa-report.md", "docs/loops/loop-15-slice-4-step4-qa-report.E_t.json"].filter((p) => existsSync(p)),
  "this session's transcript (.jsonl)": own ? [own.p] : [],
};

let total = 0;
let empty = false;
for (const [name, files] of Object.entries(categories)) {
  let hits = 0;
  for (const f of files) hits += count(f);
  total += hits;
  if (files.length === 0) empty = true;
  console.log(`${name}: files scanned ${files.length}, matches ${hits}`);
  for (const f of files) console.log(`  ${f.replace(/\\/g, "/")}`);
}
const pass = total === 0 && !empty;
console.log(`key-scan: total matches ${total}; every category scanned at least one file: ${!empty}; ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
