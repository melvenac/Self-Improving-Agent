// QA 236 T216-5 driver: positive control for the tripwire, then plan-gate dry-run on a TEMP COPY of the slice-four D_t
// under the tripwire with a canary TYPESAFE_API_KEY set. Built CLI, one process (no tsx child). Usage: node t5.mjs <open-brain dir> <tag>
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const [ob, tag] = process.argv.slice(2);
const SRC = "C:/qa-scratch/qa236-wt/docs/loops";
const NONET = "C:/qa-scratch/qa236/nonet.mjs";
const log = `C:/qa-tmp/qa236-nonet-${tag}.log`;
if (existsSync(log)) rmSync(log);
const env = { ...process.env, TEMP: "C:/qa-tmp", TMP: "C:/qa-tmp", NONET_LOG: log, TYPESAFE_API_KEY: "qa236-canary-not-a-key" };

// 1. positive control: the tripwire must catch a fetch, a socket connect and a dns lookup (all local / refused pre-connect)
const ctl = spawnSync(process.execPath, ["--import", "file:///" + NONET, "-e",
  "const net=require('node:net');const dns=require('node:dns');let n=0;" +
  "try{net.connect({host:'127.0.0.1',port:9})}catch{n++}" +
  "try{dns.lookup('localhost',()=>{})}catch{n++}" +
  "fetch('http://127.0.0.1:9/').catch(()=>{n++;console.log('control caught',n,'of 3')})"], { env, encoding: "utf8" });
console.log("control:", ctl.stdout.trim(), ctl.stderr.trim().slice(0, 200));
rmSync(log);

// 2. the real run
const dir = mkdtempSync("C:/qa-tmp/qa236-t5-");
const dt = join(dir, "loop-15-slice-4-brief.D_t.json");
const brief = join(dir, "loop-15-slice-4-brief.md");
copyFileSync(join(SRC, "loop-15-slice-4-brief.D_t.json"), dt);
copyFileSync(join(SRC, "loop-15-slice-4-brief.md"), brief);
const r = spawnSync(process.execPath, ["--import", "file:///" + NONET, join(ob, "build/harness/cli.js"),
  "plan-gate", dt, "--brief", brief, "--mode", "dry-run", "--repo", dir], { cwd: dir, env, encoding: "utf8" });
console.log("exit:", r.status);
console.log("stdout:", r.stdout.trim().slice(0, 600));
console.log("stderr:", r.stderr.trim().slice(0, 600));
console.log("dir:", dir, readdirSync(dir));
const recs = readdirSync(dir).filter((n) => n.includes(".G_plan."));
for (const n of recs) {
  const j = JSON.parse(readFileSync(join(dir, n), "utf8"));
  console.log("record:", n, JSON.stringify({ gate: j.gate, loop: j.loop, mode: j.mode, sent: j.sent, answer: j.answer, decision: j.decision, runtime_action: j.runtime_action, note: j.note }));
  console.log("canary in record:", readFileSync(join(dir, n), "utf8").includes("qa236-canary"));
}
const lines = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
const kinds = {};
for (const l of lines) kinds[l.kind] = (kinds[l.kind] ?? 0) + 1;
console.log("tripwire kinds:", JSON.stringify(kinds));
for (const l of lines) if (!["armed"].includes(l.kind)) console.log("  ", l.kind, l.detail);
console.log("network attempts:", lines.filter((l) => !["armed", "ipc"].includes(l.kind) && !l.kind.startsWith("child.")).length);
