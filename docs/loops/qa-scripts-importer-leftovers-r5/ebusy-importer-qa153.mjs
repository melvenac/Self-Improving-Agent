// QA 138: the importer's OWN read under a share=None hold, with SeBackupPrivilege disabled (so Node gets EBUSY, as on
// Forge's PC) and left enabled (as in this elevated run). Scratch copies of probes-r4's stale fixture only.
import { readFileSync, existsSync, rmSync, cpSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { createHash } from "node:crypto";
const [wt, fixture, scratch] = process.argv.slice(2);
const CLI = join(wt, "open-brain/build/cli.js");
const tree = (d) => { const m = []; const w = (p) => { for (const n of readdirSync(p).sort()) { const f = join(p, n); if (statSync(f).isDirectory()) { m.push(`D ${f.slice(d.length)}`); w(f); } else m.push(`F ${f.slice(d.length)} ${createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 12)} ${statSync(f).mtimeMs}`); } }; w(d); return m.join("\n"); };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
rmSync(scratch, { recursive: true, force: true });
const cases = [];
for (const target of [".agents/TASKS/INBOX.md", ".agents/SESSIONS/Session_7.md", ".agents/SYSTEM/SUMMARY.md", ".agents/SYSTEM/DECISIONS.md", ".agents/state.draft.json"])
  for (const args of ["--draft", "--commit"])
    for (const disable of ["SeBackupPrivilege", "none"]) cases.push({ target, args, disable });
for (const c of cases) {
  const dir = join(scratch, `${c.target.split("/").pop().replace(/\W/g, "_")}${c.args.replace(/-/g, "_")}_${c.disable}`);
  cpSync(fixture, dir, { recursive: true });
  // CURRENT project: INBOX declares Session 7, so a read that succeeds would reach the snapshot on --commit.
  writeFileSync(join(dir, ".agents/TASKS/INBOX.md"), readFileSync(join(dir, ".agents/TASKS/INBOX.md"), "utf8").replace(/Session 6/g, "Session 7"));
  if (c.target.endsWith("DECISIONS.md")) writeFileSync(join(dir, c.target), "# Decisions\n\n## ADR-1: one\n\nDate: 2026-01-01\n\nText.\n");
  const d0 = spawnSync(process.execPath, [CLI, "state", "import", "--draft"], { cwd: dir, encoding: "utf8" });
  const held = join(dir, c.target).replace(/\//g, "\\");
  const before = tree(dir);
  rmSync(held + ".held", { force: true });
  const ps = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "C:/qa-scratch/il153/s138/hold.ps1", "-Path", held, "-Share", "None", "-Seconds", "10"], { stdio: "ignore" });
  const t0 = Date.now(); while (!existsSync(held + ".held")) { if (Date.now() - t0 > 20000) throw new Error("no hold"); sleep(100); }
  sleep(500); const heldNote = readFileSync(held + ".held", "utf8").trim(); rmSync(held + ".held", { maxRetries: 10, retryDelay: 100 });
  const r = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "C:/qa-scratch/il153/s138/noprivrun.ps1", "-Disable", c.disable === "none" ? "SeNonexistentPrivilege" : c.disable, "-Cwd", dir, "-Cli", CLI, "-ArgLine", c.args], { encoding: "utf8" });
  const exited = new Promise((res) => ps.on("exit", res)); await exited;
  const after = tree(dir);
  const lines = r.stdout.split(/\r?\n/).filter((l) => /^(PRIV|EXIT|state import|Error|    at |node:|Staleness|--commit will|Wrote|Snapshot)/.test(l.trim()) || /EBUSY|refused|throw/.test(l));
  console.log(`---- hold ${c.target} share=None; ${c.args}; SeBackupPrivilege ${c.disable === "none" ? "left as is" : "DISABLED"} (${heldNote}); pre-hold draft exit ${d0.status}`);
  for (const l of lines.slice(0, 12)) console.log(`     ${l.trim().slice(0, 400)}`);
  console.log(`     tree ${before === after ? "IDENTICAL" : "CHANGED"}; state.json ${existsSync(join(dir, ".agents/state.json"))}; archive ${existsSync(join(dir, ".agents/archive")) ? JSON.stringify(readdirSync(join(dir, ".agents/archive"))) : "absent"}`);
  if (before !== after) { const b = new Set(before.split("\n")), a = new Set(after.split("\n")); for (const l of after.split("\n")) if (!b.has(l)) console.log(`       + ${l}`); for (const l of before.split("\n")) if (!a.has(l)) console.log(`       - ${l}`); }
}
