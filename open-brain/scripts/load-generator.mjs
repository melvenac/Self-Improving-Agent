#!/usr/bin/env node
// Load generator for candidate B, Step 0 (G-042). A measurement tool, not product code.
//
// G-042: the full suite exits 1 on `[vitest-worker]: Timeout calling "onTaskUpdate"` when the machine is loaded,
// while every test passes. Its acceptance needs a load that is GENERATED, with its parameters stated, so that a red
// can be reproduced and a green can be compared against the same load (design §2 Step 0, brief §2).
//
//   --cpu N        N busy-loop node processes
//   --disk M       M writers, each writing and fsyncing a 4 MiB file in a loop
//   --spawn K      K loops spawning `git --version` back to back. Process creation is the resource the harness
//                  suite contends for, so a CPU-only load could miss the channel.
//   --duration S   run for S seconds, then stop (standalone mode)
//   --report F     write the run's JSON report to F
//   -- CMD ...     wrap mode: run CMD under the load, stop the load when CMD exits, and exit with CMD's code.
//                  CMD's output is echoed and also written to --log F if given. --duration is then a safety cap.
//
// At the end every child is killed (taskkill /T on its own root on win32; its process group on POSIX), and the kill
// is PROVEN rather than asserted (design §3 B-6): each child's PID must be gone, and each child's heartbeat file must
// stop changing. A child left behind would leak load into the next measurement, so it fails the run (exit 90).

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, createWriteStream, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const LEAK_EXIT = 90;
const HEARTBEAT_MS = 250;

function parseArgs(argv) {
  const opts = { cpu: 0, disk: 0, spawn: 0, duration: 0, report: "", log: "", command: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { opts.command = argv.slice(i + 1); break; }
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    const count = (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) throw new Error(`${a} must be a non-negative integer, got ${v}`);
      return n;
    };
    if (a === "--cpu") opts.cpu = count(next());
    else if (a === "--disk") opts.disk = count(next());
    else if (a === "--spawn") opts.spawn = count(next());
    else if (a === "--duration") opts.duration = count(next());
    else if (a === "--report") opts.report = next();
    else if (a === "--log") opts.log = next();
    else throw new Error(`unknown argument: ${a}`);
  }
  if (opts.command.length === 0 && opts.duration === 0) throw new Error("give --duration S, or a command after --");
  return opts;
}

// Each child's body is inline so the generator is one tracked file. Every body writes Date.now() to its heartbeat
// file at most every HEARTBEAT_MS; the kill check reads those files twice and requires them to stand still.
const heartbeat = `const {writeFileSync}=require("fs");const hb=process.argv[1];let last=0;` +
  `function beat(){const t=Date.now();if(t-last>=${HEARTBEAT_MS}){last=t;writeFileSync(hb,String(t));}}`;

const BODIES = {
  cpu: `${heartbeat}for(;;){beat();for(let i=0;i<1e5;i++){}}`,
  disk: `${heartbeat}const fs=require("fs"),path=require("path");const dir=process.argv[2];` +
    `const buf=Buffer.alloc(4*1024*1024,7);let n=0;` +
    `for(;;){beat();const f=path.join(dir,"w"+(n++%4)+".bin");const fd=fs.openSync(f,"w");` +
    `fs.writeSync(fd,buf);fs.fsyncSync(fd);fs.closeSync(fd);}`,
  spawn: `${heartbeat}const {spawnSync}=require("child_process");` +
    `for(;;){beat();spawnSync("git",["--version"],{stdio:"ignore"});}`,
};

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

function killTree(pid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try { process.kill(-pid, "SIGKILL"); } catch { /* already gone */ }
  }
}

function readBeats(children) {
  return children.map((c) => {
    try { return readFileSync(c.heartbeat, "utf8"); } catch { return ""; }
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  for (const f of [opts.report, opts.log]) if (f) mkdirSync(dirname(f), { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "load-generator-"));
  const startedAt = new Date().toISOString();
  const params = { cpu: opts.cpu, disk: opts.disk, spawn: opts.spawn, duration: opts.duration };
  console.log(`[load-generator] start ${startedAt} params ${JSON.stringify(params)} pid ${process.pid}`);

  const children = [];
  for (const kind of ["cpu", "disk", "spawn"]) {
    for (let i = 0; i < opts[kind]; i++) {
      const hb = join(work, `${kind}-${i}.hb`);
      const dir = mkdtempSync(join(work, `${kind}-${i}-`));
      const child = spawn(process.execPath, ["-e", BODIES[kind], hb, dir], {
        stdio: "ignore",
        detached: process.platform !== "win32",
      });
      children.push({ kind, index: i, pid: child.pid, heartbeat: hb });
    }
  }
  console.log(`[load-generator] children ${JSON.stringify(children.map((c) => ({ kind: c.kind, pid: c.pid })))}`);

  let commandExit = null;
  let commandSignal = null;
  let cappedByDuration = false;
  if (opts.command.length > 0) {
    const log = opts.log ? createWriteStream(opts.log) : null;
    const cmd = spawn(opts.command[0], opts.command.slice(1), {
      stdio: ["inherit", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    for (const [src, dst] of [[cmd.stdout, process.stdout], [cmd.stderr, process.stderr]]) {
      src.on("data", (d) => { dst.write(d); log?.write(d); });
    }
    const cap = opts.duration > 0
      ? setTimeout(() => { cappedByDuration = true; killTree(cmd.pid); }, opts.duration * 1000)
      : null;
    [commandExit, commandSignal] = await new Promise((r) => cmd.on("close", (code, sig) => r([code, sig])));
    if (cap) clearTimeout(cap);
    if (log) await new Promise((r) => log.end(r));
  } else {
    await sleep(opts.duration * 1000);
  }
  const stoppedAt = new Date().toISOString();

  // Children that died on their own before the stop mean the load was not what the parameters say.
  const deadBeforeStop = children.filter((c) => !isAlive(c.pid)).map((c) => c.pid);
  for (const c of children) killTree(c.pid);

  // The proof, two instruments: PIDs gone, and heartbeats standing still across a window several beats wide.
  await sleep(1000);
  const before = readBeats(children);
  await sleep(HEARTBEAT_MS * 6);
  const after = readBeats(children);
  const alive = children.filter((c) => isAlive(c.pid)).map((c) => c.pid);
  const beating = children.filter((_, i) => before[i] !== after[i]).map((c) => c.pid);
  const neverBeat = children.filter((_, i) => after[i] === "").map((c) => c.pid);
  const leaked = [...new Set([...alive, ...beating])];

  const report = {
    startedAt, stoppedAt, params, generatorPid: process.pid,
    children: children.map(({ kind, index, pid }) => ({ kind, index, pid })),
    deadBeforeStop, neverBeat, alive, beating, leaked,
    command: opts.command.length > 0 ? opts.command.join(" ") : null,
    commandExit, commandSignal, cappedByDuration,
  };
  if (opts.report) writeFileSync(opts.report, JSON.stringify(report, null, 2));
  try { rmSync(work, { recursive: true, force: true }); } catch { /* best effort; the report is written */ }

  console.log(`[load-generator] stop ${stoppedAt} children ${children.length} alive ${alive.length} ` +
    `beating ${beating.length} neverBeat ${neverBeat.length} deadBeforeStop ${deadBeforeStop.length}`);
  if (opts.command.length > 0) console.log(`SUITE_EXIT=${commandExit}${commandSignal ? ` (signal ${commandSignal})` : ""}${cappedByDuration ? " (capped by --duration)" : ""}`);

  if (leaked.length > 0) {
    console.error(`[load-generator] LEAK: children still alive or beating after the kill: ${leaked.join(", ")}`);
    process.exit(LEAK_EXIT);
  }
  if (deadBeforeStop.length > 0 || neverBeat.length > 0) {
    console.error("[load-generator] LOAD NOT AS STATED: a child died early or never beat; this run's load is not its parameters");
    process.exit(LEAK_EXIT + 1);
  }
  process.exit(opts.command.length > 0 ? (commandExit ?? 1) : 0);
}

main().catch((e) => {
  console.error(`[load-generator] ${e.stack ?? e}`);
  process.exit(2);
});
