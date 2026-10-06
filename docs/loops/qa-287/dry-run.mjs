// QA 287: dry-run every dev row through the built CLI (harness shadow-done --mode dry-run).
// Run from the run tree root. The child gets no TYPESAFE_API_KEY. Records and ledger go to C:/qa-tmp.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = "C:/qa-tmp/qa287/dry-records";
mkdirSync(OUT, { recursive: true });
const rl = JSON.parse(readFileSync("docs/loops/jev-calibration-2/runlist.json", "utf8"));
const held = new Set(JSON.parse(readFileSync("docs/loops/jev-calibration-2-split.json", "utf8")).held_out.case_ids);
const env = { ...process.env };
delete env.TYPESAFE_API_KEY;
let ok = 0, refused = 0, other = 0;
for (const row of rl.phases.dev) {
  if (held.has(row.case_id) || row.phase !== "dev") throw new Error(`held-out guard: ${row.case_id}`);
  const r = spawnSync(process.execPath, [
    "open-brain/build/harness/cli.js", "shadow-done",
    "--request", row.input, "--policy", row.policy, "--phase", "dev",
    "--case-id", row.case_id, "--runlist", "docs/loops/jev-calibration-2/runlist.json",
    "--mode", "dry-run", "--records", OUT, "--ledger", "C:/qa-tmp/qa287/dry-ledger.jsonl",
  ], { env, encoding: "utf8" });
  const line = `${row.case_id} exit ${r.status} ${r.stdout.trim().split("\n").pop()} ${r.stderr.trim()}`;
  console.log(line);
  if (r.status === 0) ok++; else if (/exceeds ceiling/.test(r.stdout + r.stderr)) refused++; else other++;
}
const recs = readdirSync(OUT).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(OUT, f), "utf8")));
console.log(`dry-run: ${rl.phases.dev.length} dev rows, ${ok} exit 0, ${refused} size-refused, ${other} other`);
console.log(`dry-run records: ${recs.length}; sent=true in any: ${recs.some((r) => r.sent)}; modes: ${[...new Set(recs.map((r) => r.mode))]}; outcome classes: ${[...new Set(recs.map((r) => r.outcome_class))]}; size-refusal notes: ${recs.filter((r) => /exceeds ceiling/.test(r.note)).length}`);
