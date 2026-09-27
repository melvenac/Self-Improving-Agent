#!/usr/bin/env node
// Make a QA seat's driver set from qa-99's, replacing each constant EXACTLY ONCE and failing loudly otherwise.
// Written because session 100's sed copy for QA 102 silently kept three stale constants (report path, stops path,
// branch regex), which only a diff caught. Usage:
//   node docs/loops/qa-driver-copy.mjs <n> <report-rel> <dispatch-rel> <branch-prefix> "<first-prompt>"
//   node docs/loops/qa-driver-copy.mjs --harness cursor --model <id> <n> <report-rel> <dispatch-rel> <branch-prefix> "<first-prompt>"
// e.g. node docs/loops/qa-driver-copy.mjs 104 docs/loops/loop-15-slice-3-qa-report-a9.md \
//        docs/loops/loop-15-slice-3-dispatch-qa-a9.md loop-15-slice-3-a9 "You are the QA seat, record session 104, ..."
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
let harness = "claude";
let model = "";
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--harness") { harness = argv[++i] ?? ""; continue; }
  if (argv[i] === "--model") { model = argv[++i] ?? ""; continue; }
  pos.push(argv[i]);
}
if (harness !== "claude" && harness !== "cursor") { console.error("--harness must be claude or cursor"); process.exit(2); }
if (harness === "cursor" && !/^[A-Za-z0-9._-]+$/.test(model)) { console.error("--model is required with --harness cursor"); process.exit(2); }
if (harness === "claude" && model) { console.error("--model is only for --harness cursor"); process.exit(2); }

const [n, reportRel, dispatchRel, prefix, first] = pos;
if (!n || !reportRel || !dispatchRel || !prefix || !first) { console.error("usage: see header"); process.exit(2); }
if (!/^\d+$/.test(n) || !/^[a-z0-9-]+$/.test(prefix)) { console.error("bad n or prefix"); process.exit(2); }
if (first.includes("'")) { console.error("the first prompt may not contain ' (it sits in a PowerShell single-quoted string)"); process.exit(2); }

const src = harness === "cursor" ? "docs/loops/qa-driver-template-cursor" : "docs/loops/qa-driver-template";
const dst = `docs/loops/qa-${n}`;
fs.mkdirSync(dst, { recursive: true });
const win = (p) => p.replace(/\//g, "\\");

function copy(file, pairs) {
  let s = fs.readFileSync(path.join(src, file), "utf8");
  for (const [from, to] of pairs) {
    const count = s.split(from).length - 1;
    if (count !== 1) throw new Error(`${file}: expected exactly 1 of ${JSON.stringify(from)}, found ${count}`);
    s = s.replace(from, to);
  }
  fs.writeFileSync(path.join(dst, file), s);
}

const drivePairs = [
  ["# Drive QA 99 headless", `# Drive QA ${n} headless (copied from qa-99 by qa-driver-copy.mjs)`],
  ["%USERPROFILE%\\sia-qa99\\", `%USERPROFILE%\\sia-qa${n}\\`],
  ["'sia-qa99'", `'sia-qa${n}'`],
  ["'docs\\loops\\loop-15-slice-3-qa-report-a8.md'", `'${win(reportRel)}'`],
  ["'docs\\loops\\qa-99\\stops.txt'", `'docs\\loops\\qa-${n}\\stops.txt'`],
  ["'QA-99: REPORT COMPLETE'", `'QA-${n}: REPORT COMPLETE'`],
  ["'You are the QA seat, record session 99, for SIA Loop 15 slice three. Read docs/loops/loop-15-slice-3-dispatch-qa-a8.md in the current directory and follow it. Nobody is watching this run live.'", `'${first}'`],
  ["the report file docs/loops/loop-15-slice-3-qa-report-a8.md does not exist", `the report file ${reportRel} does not exist`],
];
if (harness === "cursor") drivePairs.push(["composer-2.5", model]);
copy("drive.ps1", drivePairs);
copy("stops.txt", [["QA-99: REPORT COMPLETE", `QA-${n}: REPORT COMPLETE`]]);
if (harness === "cursor") fs.copyFileSync(path.join(src, "cli.json"), path.join(dst, "cli.json"));
copy("push-qa.mjs", [
  ["// QA 99's only route", `// QA ${n}'s only route`],
  ["outside qa/loop-15-slice-3-a8-*", `outside qa/${prefix}-*`],
  ["node docs/loops/qa-99/push-qa.mjs", `node docs/loops/qa-${n}/push-qa.mjs`],
  ["/^qa\\/loop-15-slice-3-a8-[a-z0-9][a-z0-9._-]*$/", `/^qa\\/${prefix}-[a-z0-9][a-z0-9._-]*$/`],
  ["is not a qa/loop-15-slice-3-a8-* branch", `is not a qa/${prefix}-* branch`],
]);
// Guard: no stale QA-99 constant survives in the copies.
for (const f of ["drive.ps1", "stops.txt", "push-qa.mjs"]) {
  const s = fs.readFileSync(path.join(dst, f), "utf8");
  for (const stale of ["sia-qa99", "QA-99", "qa-99\\", "qa-99/", "qa-report-a8", "dispatch-qa-a8", "slice-3-a8-"]) {
    // A later number such as 9996 contains "99". The unreplaced token is the one not followed by another digit.
    const re = new RegExp(`${stale.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`);
    if (re.test(s)) throw new Error(`${f} still contains ${stale}`);
  }
}
console.log(`wrote ${dst}/drive.ps1, stops.txt, push-qa.mjs${harness === "cursor" ? ", cli.json" : ""}`);
